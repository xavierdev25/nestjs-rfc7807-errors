import { IProblemDetail } from '../interfaces/problem-detail.interface';
import { IProblemDetailSerializer } from '../interfaces/problem-detail-serializer.interface';

/**
 * JSON serializer for RFC 7807 Problem Detail objects.
 *
 * Responsibilities (SRP):
 * - Serializes an IProblemDetail to a JSON string
 * - Sets the correct content type header value
 *
 * Fields are ordered according to RFC 7807 convention:
 * type → title → status → detail → instance → extensions
 */
export class JsonProblemDetailSerializer implements IProblemDetailSerializer {
  public readonly contentType = 'application/problem+json';

  /**
   * Serializes a Problem Detail object to a JSON string.
   *
   * Undefined fields are omitted from the output.
   * Extension members are spread at the top level after
   * the standard RFC 7807 fields.
   *
   * @param problem - The problem detail object to serialize
   * @returns A JSON string with RFC 7807-compliant field ordering
   */
  serialize(problem: IProblemDetail): string {
    const { type, title, status, detail, instance, ...extensions } = problem;

    // Build ordered output: standard fields first, then extensions
    const ordered: Record<string, unknown> = { type, title, status };

    if (detail !== undefined) {
      ordered.detail = detail;
    }

    if (instance !== undefined) {
      ordered.instance = instance;
    }

    // Append extension members at the top level
    for (const [key, value] of Object.entries(extensions)) {
      if (value !== undefined) {
        ordered[key] = value;
      }
    }

    return JSON.stringify(ordered);
  }
}
