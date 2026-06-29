import { Money } from '../money.vo';

describe('Money Value Object', () => {
  describe('constructor', () => {
    it('should create a valid Money instance', () => {
      const money = new Money(1999, 'USD');
      expect(money.amountInCents).toBe(1999);
      expect(money.currency).toBe('USD');
    });

    it('should uppercase the currency code', () => {
      const money = new Money(1000, 'eur');
      expect(money.currency).toBe('EUR');
    });

    it('should throw if amount is not an integer', () => {
      expect(() => new Money(19.99, 'USD')).toThrow(
        'Amount must be an integer',
      );
    });

    it('should throw if currency is not 3 characters', () => {
      expect(() => new Money(1000, 'US')).toThrow('3-letter ISO 4217');
      expect(() => new Money(1000, 'USDX')).toThrow('3-letter ISO 4217');
    });

    it('should allow zero amount', () => {
      const money = new Money(0, 'USD');
      expect(money.amountInCents).toBe(0);
    });

    it('should allow negative amount', () => {
      const money = new Money(-500, 'USD');
      expect(money.amountInCents).toBe(-500);
    });
  });

  describe('fromDecimal', () => {
    it('should convert 19.99 to 1999 cents', () => {
      const money = Money.fromDecimal(19.99, 'USD');
      expect(money.amountInCents).toBe(1999);
    });

    it('should handle whole numbers', () => {
      const money = Money.fromDecimal(100, 'EUR');
      expect(money.amountInCents).toBe(10000);
    });

    it('should round floating point edge cases', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in floating point
      const money = Money.fromDecimal(0.3, 'USD');
      expect(money.amountInCents).toBe(30);
    });
  });

  describe('toDecimal', () => {
    it('should convert cents to decimal', () => {
      const money = new Money(1999, 'USD');
      expect(money.toDecimal()).toBe(19.99);
    });

    it('should handle zero', () => {
      const money = new Money(0, 'USD');
      expect(money.toDecimal()).toBe(0);
    });
  });

  describe('arithmetic', () => {
    it('should add two Money instances', () => {
      const a = new Money(1000, 'USD');
      const b = new Money(500, 'USD');
      const result = a.add(b);
      expect(result.amountInCents).toBe(1500);
      expect(result.currency).toBe('USD');
    });

    it('should return a new instance on add (immutability)', () => {
      const a = new Money(1000, 'USD');
      const b = new Money(500, 'USD');
      const result = a.add(b);
      expect(result).not.toBe(a);
      expect(result).not.toBe(b);
      expect(a.amountInCents).toBe(1000); // unchanged
    });

    it('should subtract two Money instances', () => {
      const a = new Money(1000, 'USD');
      const b = new Money(300, 'USD');
      const result = a.subtract(b);
      expect(result.amountInCents).toBe(700);
    });

    it('should throw on currency mismatch (add)', () => {
      const usd = new Money(1000, 'USD');
      const eur = new Money(500, 'EUR');
      expect(() => usd.add(eur)).toThrow('Currency mismatch');
    });

    it('should throw on currency mismatch (subtract)', () => {
      const usd = new Money(1000, 'USD');
      const eur = new Money(500, 'EUR');
      expect(() => usd.subtract(eur)).toThrow('Currency mismatch');
    });
  });

  describe('comparison', () => {
    it('should return true for positive amount', () => {
      expect(new Money(100, 'USD').isPositive()).toBe(true);
    });

    it('should return false for zero on isPositive', () => {
      expect(new Money(0, 'USD').isPositive()).toBe(false);
    });

    it('should return true for zero on isZero', () => {
      expect(new Money(0, 'USD').isZero()).toBe(true);
    });

    it('should return true for negative on isNegative', () => {
      expect(new Money(-100, 'USD').isNegative()).toBe(true);
    });

    it('should correctly check equality', () => {
      const a = new Money(1000, 'USD');
      const b = new Money(1000, 'USD');
      const c = new Money(1000, 'EUR');
      const d = new Money(500, 'USD');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
      expect(a.equals(d)).toBe(false);
    });
  });

  describe('format', () => {
    it('should format as currency string', () => {
      const money = Money.fromDecimal(19.99, 'USD');
      const formatted = money.format('en-US');
      expect(formatted).toContain('19.99');
    });

    it('should include currency symbol', () => {
      const money = Money.fromDecimal(100, 'EUR');
      const formatted = money.format('en-US');
      expect(formatted).toContain('€');
    });
  });

  describe('toString', () => {
    it('should return a readable string', () => {
      const money = new Money(1999, 'USD');
      expect(money.toString()).toBe('19.99 USD');
    });
  });
});
