import { IProblemDetail } from '../interfaces/problem-detail.interface';

/**
 * Parameters for constructing a ProblemDetailException.
 * The `type`, `title`, and `status` come from the concrete subclass,
 * while `detail`, `instance`, and extensions are caller-provided.
 */
export interface ProblemDetailParams {
  /**
   * URI reference identifying the problem type.
   * @default 'about:blank'
   */
  type?: string;

  /** Short, human-readable summary of the problem type. */
  title: string;

  /** HTTP status code. */
  status: number;

  /** Human-readable explanation specific to this occurrence. */
  detail?: string;

  /** URI reference identifying the specific occurrence. */
  instance?: string;

  /** Extension members for domain-specific data. */
  extensions?: Record<string, unknown>;
}

/**
 * Abstract base exception for RFC 7807 Problem Details.
 *
 * Responsibilities (SRP):
 * - Models the error data as an RFC 7807 Problem Detail
 * - Extends native Error for stack trace support
 *
 * All concrete HTTP problem exceptions extend this class (LSP).
 * The filter catches this type, so new exceptions can be added
 * without modifying the filter (OCP).
 */
export abstract class ProblemDetailException extends Error {
  /** URI reference identifying the problem type. */
  public readonly type: string;

  /** Short, human-readable summary of the problem type. */
  public readonly title: string;

  /** HTTP status code. */
  public readonly status: number;

  /** Human-readable explanation specific to this occurrence. */
  public readonly detail?: string;

  /** URI reference identifying the specific occurrence. */
  public readonly instance?: string;

  /** Extension members for domain-specific data. */
  public readonly extensions: Record<string, unknown>;

  constructor(params: ProblemDetailParams) {
    super(params.detail ?? params.title);

    this.type = params.type ?? 'about:blank';
    this.title = params.title;
    this.status = params.status;
    this.detail = params.detail;
    this.instance = params.instance;
    this.extensions = params.extensions ?? {};

    // Preserve the correct prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture a clean stack trace excluding the constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
  }

  /**
   * Converts this exception into a plain RFC 7807 Problem Detail object.
   * The returned object contains only the standard fields plus any
   * extension members — no class metadata or stack traces.
   */
  toProblemDetail(): IProblemDetail {
    const problem: IProblemDetail = {
      type: this.type,
      title: this.title,
      status: this.status,
    };

    if (this.detail !== undefined) {
      problem.detail = this.detail;
    }

    if (this.instance !== undefined) {
      problem.instance = this.instance;
    }

    // Spread extension members at the top level per RFC 7807
    for (const [key, value] of Object.entries(this.extensions)) {
      problem[key] = value;
    }

    return problem;
  }
}
