import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Response, Request } from 'express';

import { RFC7807_OPTIONS, RFC7807_SERIALIZER } from '../constants';
import { ProblemDetailException } from '../exceptions/problem-detail.exception';
import { IProblemDetail } from '../interfaces/problem-detail.interface';
import { IProblemDetailSerializer } from '../interfaces/problem-detail-serializer.interface';
import { Rfc7807ModuleOptions } from '../interfaces/rfc7807-module-options.interface';
import { JsonProblemDetailSerializer } from '../serializers/json-problem-detail.serializer';

/**
 * HTTP status code to human-readable title mapping.
 * Used when converting native NestJS HttpExceptions to RFC 7807.
 */
const HTTP_STATUS_TITLES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.GONE]: 'Gone',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.NOT_IMPLEMENTED]: 'Not Implemented',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway Timeout',
};

/**
 * Global exception filter that transforms all exceptions into
 * RFC 7807 Problem Details responses.
 *
 * Handles three scenarios:
 * 1. ProblemDetailException → serializes directly using toProblemDetail()
 * 2. NestJS HttpException → converts to RFC 7807 format
 * 3. Generic Error/unknown → responds with 500 (detail masked in production)
 *
 * Responsibilities (SRP):
 * - Catches exceptions and transforms them into HTTP responses
 * - Delegates serialization to IProblemDetailSerializer (DIP)
 */
@Catch()
export class Rfc7807ExceptionFilter implements ExceptionFilter {
  private readonly serializer: IProblemDetailSerializer;
  private readonly options: Rfc7807ModuleOptions;

  constructor(
    @Optional()
    @Inject(RFC7807_SERIALIZER)
    serializer?: IProblemDetailSerializer,
    @Optional()
    @Inject(RFC7807_OPTIONS)
    options?: Rfc7807ModuleOptions,
  ) {
    this.serializer = serializer ?? new JsonProblemDetailSerializer();
    this.options = options ?? {};
  }

  /**
   * Entry point for exception handling.
   * Routes the exception to the appropriate handler based on its type.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.buildProblemDetail(exception, request);

    // Conditionally include stack trace (never in production)
    if (
      this.options.includeStackTrace &&
      process.env.NODE_ENV !== 'production' &&
      exception instanceof Error
    ) {
      problem.stackTrace = exception.stack;
    }

    // Invoke the optional callback for logging/metrics
    if (this.options.onProblem && exception instanceof Error) {
      this.options.onProblem(problem, exception);
    }

    const serialized = this.serializer.serialize(problem);

    response
      .status(problem.status)
      .setHeader('Content-Type', this.serializer.contentType)
      .send(serialized);
  }

  /**
   * Builds an IProblemDetail from the caught exception.
   *
   * Strategy:
   * 1. ProblemDetailException: use toProblemDetail() directly
   * 2. HttpException: extract status/message, map to RFC 7807
   * 3. Unknown: generic 500 with masked detail in production
   */
  private buildProblemDetail(
    exception: unknown,
    request: Request,
  ): IProblemDetail {
    // Scenario 1: Our own ProblemDetailException
    if (exception instanceof ProblemDetailException) {
      const problem = exception.toProblemDetail();
      if (!problem.instance) {
        problem.instance = request.url;
      }
      return this.applyTypeBaseUri(problem);
    }

    // Scenario 2: NestJS built-in HttpException
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    // Scenario 3: Unknown error — masked 500
    return this.fromUnknownError(exception, request);
  }

  /**
   * Converts a NestJS HttpException to an RFC 7807 Problem Detail.
   * Extracts validation errors from the response object when present.
   */
  private fromHttpException(
    exception: HttpException,
    request: Request,
  ): IProblemDetail {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const title = HTTP_STATUS_TITLES[status] ?? `HTTP Error ${status}`;

    const problem: IProblemDetail = {
      type: this.resolveTypeUri(title),
      title,
      status,
      instance: request.url,
    };

    // Extract detail from the exception response
    if (typeof exceptionResponse === 'string') {
      problem.detail = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as Record<string, unknown>;

      if (typeof responseObj.message === 'string') {
        problem.detail = responseObj.message;
      } else if (Array.isArray(responseObj.message)) {
        // NestJS validation pipe returns an array of messages
        problem.detail = 'Validation failed';
        problem.errors = responseObj.message;
      }
    }

    return problem;
  }

  /**
   * Creates a 500 Internal Server Error problem detail
   * for unrecognized exceptions. In production, the detail
   * is masked to prevent information leakage.
   */
  private fromUnknownError(
    exception: unknown,
    request: Request,
  ): IProblemDetail {
    const isProduction = process.env.NODE_ENV === 'production';
    const detail = isProduction
      ? 'An unexpected error occurred'
      : exception instanceof Error
        ? exception.message
        : String(exception);

    return {
      type: this.resolveTypeUri('Internal Server Error'),
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
      instance: request.url,
    };
  }

  /**
   * Resolves the `type` URI by combining the configured base URI
   * with a slug derived from the error title.
   */
  private resolveTypeUri(title: string): string {
    if (
      !this.options.typeBaseUri ||
      this.options.typeBaseUri === 'about:blank'
    ) {
      return 'about:blank';
    }

    const slug = title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return `${this.options.typeBaseUri.replace(/\/+$/, '')}/${slug}`;
  }

  /**
   * Applies the typeBaseUri to a problem detail if the type is
   * still the default 'about:blank' and a base URI is configured.
   */
  private applyTypeBaseUri(problem: IProblemDetail): IProblemDetail {
    if (
      problem.type === 'about:blank' &&
      this.options.typeBaseUri &&
      this.options.typeBaseUri !== 'about:blank'
    ) {
      problem.type = this.resolveTypeUri(problem.title);
    }
    return problem;
  }
}
