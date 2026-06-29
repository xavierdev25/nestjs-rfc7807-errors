import { ProblemDetailException } from './problem-detail.exception';

/**
 * Options accepted by all concrete HTTP problem detail exceptions.
 * The `status` and `title` are pre-configured by each subclass.
 */
export interface HttpProblemOptions {
  /** Human-readable explanation specific to this occurrence. */
  detail?: string;

  /** URI reference identifying the specific occurrence. */
  instance?: string;

  /** URI reference identifying the problem type. */
  type?: string;

  /** Extension members for domain-specific data. */
  extensions?: Record<string, unknown>;
}

/**
 * 400 Bad Request
 *
 * The server cannot process the request due to something perceived
 * to be a client error (e.g., malformed request syntax).
 */
export class BadRequestProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 401 Unauthorized
 *
 * The request lacks valid authentication credentials for the
 * target resource.
 */
export class UnauthorizedProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Unauthorized',
      status: 401,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 403 Forbidden
 *
 * The server understood the request but refuses to authorize it.
 */
export class ForbiddenProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 404 Not Found
 *
 * The origin server did not find a current representation for
 * the target resource.
 */
export class NotFoundProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 409 Conflict
 *
 * The request could not be completed due to a conflict with the
 * current state of the target resource.
 */
export class ConflictProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 422 Unprocessable Entity
 *
 * The server understands the content type and syntax of the request
 * but was unable to process the contained instructions.
 */
export class UnprocessableEntityProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 429 Too Many Requests
 *
 * The user has sent too many requests in a given amount of time
 * ("rate limiting").
 */
export class TooManyRequestsProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}

/**
 * 500 Internal Server Error
 *
 * The server encountered an unexpected condition that prevented
 * it from fulfilling the request.
 */
export class InternalServerErrorProblem extends ProblemDetailException {
  constructor(options: HttpProblemOptions = {}) {
    super({
      type: options.type ?? 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: options.detail,
      instance: options.instance,
      extensions: options.extensions,
    });
  }
}
