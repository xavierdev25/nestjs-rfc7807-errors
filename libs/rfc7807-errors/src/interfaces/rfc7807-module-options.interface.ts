import { ModuleMetadata, Type } from '@nestjs/common';
import { IProblemDetail } from './problem-detail.interface';
import { IProblemDetailSerializer } from './problem-detail-serializer.interface';
import { ExceptionMapper } from './exception-mapper.interface';

/**
 * Configuration options for the Rfc7807Module.
 */
export interface Rfc7807ModuleOptions {
  /**
   * Custom serializer implementation.
   * Defaults to JsonProblemDetailSerializer if not provided.
   */
  serializer?: IProblemDetailSerializer;

  /**
   * Additional exception mappers, tried (in order) BEFORE the built-in ones.
   * Use this to support any error source — other ORMs, gRPC, third-party
   * SDKs — without modifying the library (Open/Closed).
   */
  mappers?: ExceptionMapper[];

  /**
   * Translate database driver errors (PostgreSQL / TypeORM / Prisma) into the
   * proper HTTP status (e.g. unique violation → 409). Sensitive driver detail
   * is masked in production.
   * @default true
   */
  databaseErrors?: boolean;

  /**
   * Whether to include the stack trace in error responses.
   * Only applies when NODE_ENV is not 'production'.
   * @default false
   */
  includeStackTrace?: boolean;

  /**
   * Callback invoked on every caught exception, after the
   * Problem Detail is constructed but before the response is sent.
   * Useful for logging, metrics, or error tracking integration.
   */
  onProblem?: (problem: IProblemDetail, exception: Error) => void;

  /**
   * Base URI prefix for the `type` field.
   * Problem types will be constructed as `{typeBaseUri}/{error-slug}`.
   * @default 'about:blank'
   */
  typeBaseUri?: string;
}

/**
 * Factory interface for creating module options asynchronously.
 */
export interface Rfc7807OptionsFactory {
  createRfc7807Options(): Rfc7807ModuleOptions | Promise<Rfc7807ModuleOptions>;
}

/**
 * Async configuration options for Rfc7807Module.forRootAsync().
 * Supports useFactory, useClass, and useExisting patterns.
 */
export interface Rfc7807ModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  /**
   * Factory function to create the options.
   */
  useFactory?: (
    ...args: any[]
  ) => Rfc7807ModuleOptions | Promise<Rfc7807ModuleOptions>;

  /**
   * Dependencies to inject into the factory function.
   */
  inject?: any[];

  /**
   * Class that implements Rfc7807OptionsFactory.
   */
  useClass?: Type<Rfc7807OptionsFactory>;

  /**
   * Existing provider that implements Rfc7807OptionsFactory.
   */
  useExisting?: Type<Rfc7807OptionsFactory>;
}
