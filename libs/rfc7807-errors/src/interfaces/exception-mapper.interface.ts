import { IProblemDetail } from './problem-detail.interface';

/**
 * Context handed to every mapper for the current exception.
 */
export interface ExceptionMappingContext {
  /** Request URI, used as the problem `instance` when a mapper omits it. */
  instance?: string;
  /** True when NODE_ENV === 'production' (so mappers can mask sensitive detail). */
  isProduction: boolean;
}

/**
 * Maps a thrown exception to an RFC 7807 Problem Detail.
 *
 * Implements the Chain of Responsibility: return a Problem Detail if this
 * mapper handles the exception, or `null` to defer to the next mapper. Custom
 * mappers can be registered via `Rfc7807Module` options to support any error
 * source (other ORMs, gRPC, third-party SDKs, …) without modifying the
 * library — Open/Closed.
 */
export interface ExceptionMapper {
  map(
    exception: unknown,
    context: ExceptionMappingContext,
  ): IProblemDetail | null;
}
