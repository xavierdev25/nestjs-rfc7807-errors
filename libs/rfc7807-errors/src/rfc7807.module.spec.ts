import { Test, TestingModule } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { Rfc7807Module } from './rfc7807.module';
import { RFC7807_OPTIONS, RFC7807_SERIALIZER } from './constants';
import { JsonProblemDetailSerializer } from './serializers/json-problem-detail.serializer';
import {
  Rfc7807ModuleOptions,
  Rfc7807OptionsFactory,
} from './interfaces/rfc7807-module-options.interface';
import { Injectable } from '@nestjs/common';

describe('Rfc7807Module', () => {
  describe('forRoot()', () => {
    it('should register providers with default options', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [Rfc7807Module.forRoot()],
      }).compile();

      const options = module.get(RFC7807_OPTIONS);
      const serializer = module.get(RFC7807_SERIALIZER);

      expect(options).toEqual({});
      expect(serializer).toBeInstanceOf(JsonProblemDetailSerializer);
    });

    it('should register providers with custom options', async () => {
      const onProblem = jest.fn();
      const customOptions: Rfc7807ModuleOptions = {
        includeStackTrace: true,
        typeBaseUri: 'https://api.example.com/errors',
        onProblem,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [Rfc7807Module.forRoot(customOptions)],
      }).compile();

      const options = module.get<Rfc7807ModuleOptions>(RFC7807_OPTIONS);

      expect(options.includeStackTrace).toBe(true);
      expect(options.typeBaseUri).toBe('https://api.example.com/errors');
      expect(options.onProblem).toBe(onProblem);
    });

    it('should use custom serializer when provided', async () => {
      const customSerializer = {
        contentType: 'application/problem+xml',
        serialize: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [Rfc7807Module.forRoot({ serializer: customSerializer })],
      }).compile();

      const serializer = module.get(RFC7807_SERIALIZER);
      expect(serializer.contentType).toBe('application/problem+xml');
    });

    it('should include APP_FILTER provider in the dynamic module definition', () => {
      const dynamicModule = Rfc7807Module.forRoot();

      expect(dynamicModule.providers).toBeDefined();
      const hasAppFilter = dynamicModule.providers!.some(
        (provider: any) =>
          provider.provide?.toString() === 'APP_FILTER' ||
          provider.provide === 'APP_FILTER',
      );
      expect(hasAppFilter).toBe(true);
    });
  });

  describe('forRootAsync()', () => {
    it('should support useFactory pattern', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          Rfc7807Module.forRootAsync({
            useFactory: () => ({
              includeStackTrace: false,
              typeBaseUri: 'https://async.example.com/errors',
            }),
          }),
        ],
      }).compile();

      const options = module.get<Rfc7807ModuleOptions>(RFC7807_OPTIONS);
      expect(options.includeStackTrace).toBe(false);
      expect(options.typeBaseUri).toBe('https://async.example.com/errors');
    });

    it('should support useFactory with inject from an external module', async () => {
      const CONFIG_TOKEN = 'CONFIG_TOKEN';

      @Module({
        providers: [{ provide: CONFIG_TOKEN, useValue: { debug: true } }],
        exports: [CONFIG_TOKEN],
      })
      class ConfigModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule,
          Rfc7807Module.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: { debug: boolean }) => ({
              includeStackTrace: config.debug,
            }),
            inject: [CONFIG_TOKEN],
          }),
        ],
      }).compile();

      const options = module.get<Rfc7807ModuleOptions>(RFC7807_OPTIONS);
      expect(options.includeStackTrace).toBe(true);
    });

    it('should support useClass pattern', async () => {
      @Injectable()
      class TestOptionsFactory implements Rfc7807OptionsFactory {
        createRfc7807Options(): Rfc7807ModuleOptions {
          return {
            includeStackTrace: true,
            typeBaseUri: 'https://class.example.com/errors',
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          Rfc7807Module.forRootAsync({
            useClass: TestOptionsFactory,
          }),
        ],
      }).compile();

      const options = module.get<Rfc7807ModuleOptions>(RFC7807_OPTIONS);
      expect(options.includeStackTrace).toBe(true);
      expect(options.typeBaseUri).toBe('https://class.example.com/errors');
    });

    it('should include APP_FILTER provider in the async dynamic module definition', () => {
      const dynamicModule = Rfc7807Module.forRootAsync({
        useFactory: () => ({}),
      });

      expect(dynamicModule.providers).toBeDefined();
      const hasAppFilter = dynamicModule.providers!.some(
        (provider: any) =>
          provider.provide?.toString() === 'APP_FILTER' ||
          provider.provide === 'APP_FILTER',
      );
      expect(hasAppFilter).toBe(true);
    });

    it('should register JsonProblemDetailSerializer by default in async mode', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          Rfc7807Module.forRootAsync({
            useFactory: () => ({}),
          }),
        ],
      }).compile();

      const serializer = module.get(RFC7807_SERIALIZER);
      expect(serializer).toBeInstanceOf(JsonProblemDetailSerializer);
    });
  });
});
