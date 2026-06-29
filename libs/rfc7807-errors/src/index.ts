/**
 * @xavierdev25/rfc7807-errors
 *
 * NestJS global exception filter implementing RFC 7807 Problem Details
 * for HTTP APIs (application/problem+json).
 *
 * @see https://www.rfc-editor.org/rfc/rfc7807
 * @packageDocumentation
 */

// Module
export { Rfc7807Module } from './rfc7807.module';

// Constants
export { RFC7807_OPTIONS, RFC7807_SERIALIZER } from './constants';

// Interfaces
export {
  IProblemDetail,
  IProblemDetailSerializer,
  ExceptionMapper,
  ExceptionMappingContext,
  Rfc7807ModuleOptions,
  Rfc7807ModuleAsyncOptions,
  Rfc7807OptionsFactory,
} from './interfaces';

// Exceptions
export {
  ProblemDetailException,
  ProblemDetailParams,
  HttpProblemOptions,
  BadRequestProblem,
  UnauthorizedProblem,
  ForbiddenProblem,
  NotFoundProblem,
  ConflictProblem,
  UnprocessableEntityProblem,
  TooManyRequestsProblem,
  InternalServerErrorProblem,
} from './exceptions';

// Serializers
export { JsonProblemDetailSerializer } from './serializers';

// Filters
export { Rfc7807ExceptionFilter } from './filters';

// Mappers (database driver errors → RFC 7807)
export { DatabaseExceptionMapper } from './mappers';

// Validation (class-validator → RFC 7807 BadRequestProblem)
export {
  rfc7807ValidationExceptionFactory,
  flattenValidationErrors,
  ValidationErrorLike,
  ValidationViolation,
} from './validation';
