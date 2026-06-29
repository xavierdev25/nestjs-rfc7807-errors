import { IProblemDetail } from '../interfaces/problem-detail.interface';
import {
  ExceptionMapper,
  ExceptionMappingContext,
} from '../interfaces/exception-mapper.interface';

/**
 * Maps database driver errors (PostgreSQL via TypeORM's `QueryFailedError`, the
 * raw `pg` driver, or Prisma's `PrismaClientKnownRequestError`) to RFC 7807
 * Problem Details with a meaningful HTTP status — e.g. a unique-constraint
 * violation becomes `409 Conflict` instead of a generic `500`.
 *
 * It is **dependency-free**: detection is done by duck-typing (`constructor.name`,
 * error `code`, driver shape), so the library never imports TypeORM/Prisma/pg
 * and works regardless of which the consumer uses.
 *
 * Security: in production the human-readable `detail` is generic and the
 * driver's raw message/constraint/column (which can leak schema internals) is
 * omitted. In non-production those land under the `dbError` extension for
 * debugging.
 */
export class DatabaseExceptionMapper implements ExceptionMapper {
  /** PostgreSQL SQLSTATE → { status, title, safe detail }. */
  private static readonly PG: Record<
    string,
    { status: number; title: string; detail: string }
  > = {
    '23505': {
      status: 409,
      title: 'Conflict',
      detail: 'A resource with the same unique value already exists.',
    },
    '23503': {
      status: 409,
      title: 'Conflict',
      detail:
        'The request references a related resource that does not exist or is still in use.',
    },
    '23502': {
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'A required field is missing.',
    },
    '23514': {
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'A field violates a database constraint.',
    },
    '23P01': {
      status: 409,
      title: 'Conflict',
      detail: 'The request conflicts with an existing resource.',
    },
    '22P02': {
      status: 400,
      title: 'Bad Request',
      detail: 'Invalid input syntax for one of the provided values.',
    },
    '22001': {
      status: 400,
      title: 'Bad Request',
      detail: 'A value is too long for its field.',
    },
    '40001': {
      status: 409,
      title: 'Conflict',
      detail: 'The operation could not be serialized; please retry.',
    },
    '40P01': {
      status: 409,
      title: 'Conflict',
      detail: 'A deadlock was detected; please retry.',
    },
  };

  /** Prisma known-request error codes → { status, title, safe detail }. */
  private static readonly PRISMA: Record<
    string,
    { status: number; title: string; detail: string }
  > = {
    P2002: {
      status: 409,
      title: 'Conflict',
      detail: 'A resource with the same unique value already exists.',
    },
    P2003: {
      status: 409,
      title: 'Conflict',
      detail:
        'The request references a related resource that does not exist or is still in use.',
    },
    P2025: {
      status: 404,
      title: 'Not Found',
      detail: 'The requested resource was not found.',
    },
    P2000: {
      status: 400,
      title: 'Bad Request',
      detail: 'A value is too long for its field.',
    },
    P2011: {
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'A required field is missing.',
    },
  };

  map(
    exception: unknown,
    context: ExceptionMappingContext,
  ): IProblemDetail | null {
    if (exception === null || typeof exception !== 'object') {
      return null;
    }
    const err = exception as Record<string, unknown>;
    const name = (err.constructor as { name?: string })?.name ?? '';
    const code = typeof err.code === 'string' ? err.code : undefined;

    // Prisma: PrismaClientKnownRequestError, or any error with a P#### code.
    if (name === 'PrismaClientKnownRequestError' || (code && /^P\d{4}$/.test(code))) {
      return this.build(DatabaseExceptionMapper.PRISMA[code ?? ''], err, code, context);
    }

    // PostgreSQL: TypeORM QueryFailedError wraps the driver error in
    // `driverError`; the raw `pg` error exposes `code` + `severity`/`routine`.
    const driver = err.driverError as Record<string, unknown> | undefined;
    const pgCode =
      (typeof driver?.code === 'string' ? driver.code : undefined) ??
      (code && /^[0-9A-Z]{5}$/.test(code) ? code : undefined);
    const looksPostgres =
      name === 'QueryFailedError' ||
      driver !== undefined ||
      err.severity !== undefined ||
      err.routine !== undefined;

    if (pgCode && looksPostgres) {
      return this.build(
        DatabaseExceptionMapper.PG[pgCode],
        (driver ?? err) as Record<string, unknown>,
        pgCode,
        context,
      );
    }

    return null;
  }

  /**
   * Builds the Problem Detail for a recognized DB error. Returns `null` for an
   * unrecognized code so the chain falls through to the generic 500 handler
   * (we never surface an unknown DB error as a misleading 4xx).
   */
  private build(
    mapped:
      | { status: number; title: string; detail: string }
      | undefined,
    raw: Record<string, unknown>,
    code: string | undefined,
    context: ExceptionMappingContext,
  ): IProblemDetail | null {
    if (!mapped) {
      return null;
    }

    const problem: IProblemDetail = {
      type: 'about:blank',
      title: mapped.title,
      status: mapped.status,
      detail: mapped.detail,
    };
    if (context.instance) {
      problem.instance = context.instance;
    }

    // Debug info only outside production (avoid leaking schema internals).
    if (!context.isProduction) {
      problem.dbError = {
        code,
        constraint: raw.constraint,
        table: raw.table,
        column: raw.column,
        message: raw.message ?? raw.detail,
      };
    }

    return problem;
  }
}
