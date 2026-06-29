/**
 * Money Value Object.
 *
 * Represents a monetary amount using integer cents to avoid floating-point
 * precision issues. Follows the "Money Pattern" from Martin Fowler.
 *
 * Immutable: all operations return new instances.
 */
export class Money {
  /**
   * @param amountInCents - The amount in the smallest currency unit (e.g., cents)
   * @param currency - ISO 4217 currency code (e.g., 'USD', 'EUR')
   */
  constructor(
    public readonly amountInCents: number,
    public readonly currency: string,
  ) {
    if (!Number.isInteger(amountInCents)) {
      throw new Error('Amount must be an integer (cents)');
    }
    if (currency.length !== 3) {
      throw new Error('Currency must be a 3-letter ISO 4217 code');
    }
    this.currency = currency.toUpperCase();
  }

  /**
   * Creates a Money instance from a decimal amount (e.g., 19.99 → 1999 cents).
   */
  static fromDecimal(amount: number, currency: string): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  /**
   * Returns the amount as a decimal number.
   */
  toDecimal(): number {
    return this.amountInCents / 100;
  }

  /**
   * Adds two Money instances. Currencies must match.
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountInCents + other.amountInCents, this.currency);
  }

  /**
   * Subtracts another Money instance. Currencies must match.
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountInCents - other.amountInCents, this.currency);
  }

  /**
   * Checks if the amount is positive (> 0).
   */
  isPositive(): boolean {
    return this.amountInCents > 0;
  }

  /**
   * Checks if the amount is zero.
   */
  isZero(): boolean {
    return this.amountInCents === 0;
  }

  /**
   * Checks if the amount is negative.
   */
  isNegative(): boolean {
    return this.amountInCents < 0;
  }

  /**
   * Checks equality with another Money instance.
   */
  equals(other: Money): boolean {
    return (
      this.amountInCents === other.amountInCents &&
      this.currency === other.currency
    );
  }

  /**
   * Formats the amount as a locale-aware currency string.
   * @example Money.fromDecimal(19.99, 'USD').format() → "$19.99"
   */
  format(locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.toDecimal());
  }

  /**
   * Returns a string representation for debugging.
   */
  toString(): string {
    return `${this.toDecimal()} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot operate on ${this.currency} and ${other.currency}`,
      );
    }
  }
}
