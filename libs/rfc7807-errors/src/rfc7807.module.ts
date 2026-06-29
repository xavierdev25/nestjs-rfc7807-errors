import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { RFC7807_OPTIONS, RFC7807_SERIALIZER } from './constants';
import { Rfc7807ExceptionFilter } from './filters/rfc7807-exception.filter';
import {
  Rfc7807ModuleOptions,
  Rfc7807ModuleAsyncOptions,
  Rfc7807OptionsFactory,
} from './interfaces/rfc7807-module-options.interface';
import { JsonProblemDetailSerializer } from './serializers/json-problem-detail.serializer';

/**
 * Global NestJS module that registers the RFC 7807 exception filter.
 *
 * Usage:
 * ```typescript
 * // Synchronous configuration
 * Rfc7807Module.forRoot({
 *   includeStackTrace: true,
 *   typeBaseUri: 'https://api.example.com/errors',
 * })
 *
 * // Asynchronous configuration
 * Rfc7807Module.forRootAsync({
 *   useFactory: (configService: ConfigService) => ({
 *     includeStackTrace: configService.get('DEBUG') === 'true',
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 *
 * Open/Closed Principle: New serializers or options can be injected
 * without modifying this module's code.
 */
@Global()
@Module({})
export class Rfc7807Module {
  /**
   * Register the module with synchronous options.
   *
   * @param options - Configuration options (all optional)
   * @returns A configured DynamicModule
   */
  static forRoot(options: Rfc7807ModuleOptions = {}): DynamicModule {
    const serializer = options.serializer ?? new JsonProblemDetailSerializer();

    const providers: Provider[] = [
      {
        provide: RFC7807_OPTIONS,
        useValue: options,
      },
      {
        provide: RFC7807_SERIALIZER,
        useValue: serializer,
      },
      {
        provide: APP_FILTER,
        useClass: Rfc7807ExceptionFilter,
      },
    ];

    return {
      module: Rfc7807Module,
      providers,
      exports: [RFC7807_OPTIONS, RFC7807_SERIALIZER],
    };
  }

  /**
   * Register the module with asynchronous options.
   * Supports useFactory, useClass, and useExisting patterns.
   *
   * @param asyncOptions - Async configuration
   * @returns A configured DynamicModule
   */
  static forRootAsync(asyncOptions: Rfc7807ModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...Rfc7807Module.createAsyncProviders(asyncOptions),
      {
        provide: RFC7807_SERIALIZER,
        useFactory: (options: Rfc7807ModuleOptions) =>
          options.serializer ?? new JsonProblemDetailSerializer(),
        inject: [RFC7807_OPTIONS],
      },
      {
        provide: APP_FILTER,
        useClass: Rfc7807ExceptionFilter,
      },
    ];

    return {
      module: Rfc7807Module,
      imports: asyncOptions.imports ?? [],
      providers,
      exports: [RFC7807_OPTIONS, RFC7807_SERIALIZER],
    };
  }

  /**
   * Creates the async providers based on the configuration pattern.
   */
  private static createAsyncProviders(
    asyncOptions: Rfc7807ModuleAsyncOptions,
  ): Provider[] {
    if (asyncOptions.useFactory) {
      return [
        {
          provide: RFC7807_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
      ];
    }

    if (asyncOptions.useClass) {
      return [
        {
          provide: asyncOptions.useClass,
          useClass: asyncOptions.useClass,
        },
        {
          provide: RFC7807_OPTIONS,
          useFactory: (factory: Rfc7807OptionsFactory) =>
            factory.createRfc7807Options(),
          inject: [asyncOptions.useClass],
        },
      ];
    }

    if (asyncOptions.useExisting) {
      return [
        {
          provide: RFC7807_OPTIONS,
          useFactory: (factory: Rfc7807OptionsFactory) =>
            factory.createRfc7807Options(),
          inject: [asyncOptions.useExisting],
        },
      ];
    }

    return [
      {
        provide: RFC7807_OPTIONS,
        useValue: {},
      },
    ];
  }
}
