import { DatabaseExceptionMapper } from '../database-exception.mapper';

// Fakes that reproduce the *shape* the mapper duck-types on, without importing
// typeorm/prisma/pg.
class QueryFailedError extends Error {
  constructor(public driverError: Record<string, unknown>) {
    super('query failed');
  }
}
class PrismaClientKnownRequestError extends Error {
  constructor(public code: string) {
    super('prisma error');
  }
}

const ctx = (isProduction = false) => ({
  instance: '/resource',
  isProduction,
});

describe('DatabaseExceptionMapper', () => {
  const mapper = new DatabaseExceptionMapper();

  describe('PostgreSQL (TypeORM QueryFailedError)', () => {
    it('maps unique violation (23505) → 409', () => {
      const e = new QueryFailedError({ code: '23505', constraint: 'uq_email' });
      const p = mapper.map(e, ctx());
      expect(p?.status).toBe(409);
      expect(p?.title).toBe('Conflict');
      expect(p?.instance).toBe('/resource');
    });

    it('maps not-null violation (23502) → 422', () => {
      const p = mapper.map(new QueryFailedError({ code: '23502' }), ctx());
      expect(p?.status).toBe(422);
    });

    it('maps foreign-key violation (23503) → 409', () => {
      const p = mapper.map(new QueryFailedError({ code: '23503' }), ctx());
      expect(p?.status).toBe(409);
    });

    it('maps invalid text syntax (22P02) → 400', () => {
      const p = mapper.map(new QueryFailedError({ code: '22P02' }), ctx());
      expect(p?.status).toBe(400);
    });

    it('maps a raw pg error (code + severity) → 409', () => {
      const raw = { code: '23505', severity: 'ERROR', constraint: 'uq_x' };
      const p = mapper.map(raw, ctx());
      expect(p?.status).toBe(409);
    });
  });

  describe('Prisma', () => {
    it('maps P2002 (unique) → 409', () => {
      const p = mapper.map(new PrismaClientKnownRequestError('P2002'), ctx());
      expect(p?.status).toBe(409);
    });

    it('maps P2025 (not found) → 404', () => {
      const p = mapper.map(new PrismaClientKnownRequestError('P2025'), ctx());
      expect(p?.status).toBe(404);
    });

    it('detects a Prisma error by code shape alone (no class name)', () => {
      const p = mapper.map({ code: 'P2003' }, ctx());
      expect(p?.status).toBe(409);
    });

    it('returns null for an unknown Prisma code', () => {
      expect(mapper.map({ code: 'P9999' }, ctx())).toBeNull();
    });
  });

  describe('postgres detection variants (branch coverage)', () => {
    it('detects via the pg `routine` field', () => {
      const p = mapper.map({ code: '23505', routine: 'exec_simple_query' }, ctx());
      expect(p?.status).toBe(409);
    });

    it('reads a top-level code on a QueryFailedError without driverError', () => {
      const e = Object.assign(new QueryFailedError(undefined as never), {
        code: '23502',
      });
      const p = mapper.map(e, ctx());
      expect(p?.status).toBe(422);
    });
  });

  describe('masking', () => {
    it('includes dbError debug info in non-production', () => {
      const e = new QueryFailedError({ code: '23505', constraint: 'uq_email' });
      const p = mapper.map(e, ctx(false));
      expect(p?.dbError).toMatchObject({ code: '23505', constraint: 'uq_email' });
    });

    it('omits dbError in production', () => {
      const e = new QueryFailedError({ code: '23505', constraint: 'uq_email' });
      const p = mapper.map(e, ctx(true));
      expect(p?.dbError).toBeUndefined();
      expect(p?.detail).not.toContain('uq_email');
    });
  });

  describe('non-matches (fall through)', () => {
    it('returns null for an unknown PG code', () => {
      expect(mapper.map(new QueryFailedError({ code: '99999' }), ctx())).toBeNull();
    });

    it('returns null for a plain Error', () => {
      expect(mapper.map(new Error('boom'), ctx())).toBeNull();
    });

    it('returns null for non-objects', () => {
      expect(mapper.map('nope', ctx())).toBeNull();
      expect(mapper.map(null, ctx())).toBeNull();
    });
  });
});
