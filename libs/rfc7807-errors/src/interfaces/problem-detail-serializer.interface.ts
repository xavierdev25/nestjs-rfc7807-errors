import { IProblemDetail } from './problem-detail.interface';

/**
 * Strategy interface for serializing Problem Detail objects.
 *
 * Follows the Dependency Inversion Principle: the exception filter
 * depends on this abstraction rather than a concrete serializer.
 * This allows consumers to swap JSON serialization for XML or
 * any other format without modifying the filter.
 */
export interface IProblemDetailSerializer {
  /**
   * The MIME content type this serializer produces.
   * @example 'application/problem+json'
   * @example 'application/problem+xml'
   */
  readonly contentType: string;

  /**
   * Serializes a Problem Detail object into a string representation.
   *
   * @param problem - The problem detail to serialize
   * @returns The serialized string (e.g., JSON, XML)
   */
  serialize(problem: IProblemDetail): string;
}
