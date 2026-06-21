import { HttpException, HttpStatus } from '@nestjs/common';
import { Rfc7807ExceptionFilter } from '../rfc7807-exception.filter';
import {
  NotFoundProblem,
  BadRequestProblem,
} from '../../exceptions/http-problem-detail.exceptions';
import { IProblemDetail } from '../../interfaces/problem-detail.interface';
import { IProblemDetailSerializer } from '../../interfaces/problem-detail-serializer.interface';
import { JsonProblemDetailSerializer } from '../../serializers/json-problem-detail.serializer';

/**
 * Creates a mock Express Response object.
 */
function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Creates a mock Express Request object.
 */
function createMockRequest(url = '/api/v1/test') {
  return { url };
}

/**
 * Creates a mock NestJS ArgumentsHost.
 */
function createMockArgumentsHost(
  request = createMockRequest(),
  response = createMockResponse(),
) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as any;
}

describe('Rfc7807ExceptionFilter', () => {
  let filter: Rfc7807ExceptionFilter;
  let mockResponse: ReturnType<typeof createMockResponse>;
  let mockHost: any;

  beforeEach(() => {
    filter = new Rfc7807ExceptionFilter();
    mockResponse = createMockResponse();
    mockHost = createMockArgumentsHost(createMockRequest(), mockResponse);
  });

  describe('ProblemDetailException handling', () => {
    it('should serialize a ProblemDetailException to RFC 7807 response', () => {
      const exception = new NotFoundProblem({
        detail: 'User 42 not found',
        instance: '/api/v1/users/42',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.type).toBe('about:blank');
      expect(sentBody.title).toBe('Not Found');
      expect(sentBody.status).toBe(404);
      expect(sentBody.detail).toBe('User 42 not found');
      expect(sentBody.instance).toBe('/api/v1/users/42');
    });

    it('should set instance from request URL when not provided', () => {
      const request = createMockRequest('/api/v1/orders');
      const host = createMockArgumentsHost(request, mockResponse);
      const exception = new BadRequestProblem({
        detail: 'Invalid order data',
      });

      filter.catch(exception, host);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.instance).toBe('/api/v1/orders');
    });

    it('should preserve extension members from ProblemDetailException', () => {
      const exception = new BadRequestProblem({
        detail: 'Validation failed',
        extensions: {
          errors: [{ field: 'email', message: 'invalid format' }],
        },
      });

      filter.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.errors).toEqual([
        { field: 'email', message: 'invalid format' },
      ]);
    });
  });

  describe('NestJS HttpException handling', () => {
    it('should convert a NestJS HttpException to RFC 7807', () => {
      const exception = new HttpException(
        'Resource not found',
        HttpStatus.NOT_FOUND,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.type).toBe('about:blank');
      expect(sentBody.title).toBe('Not Found');
      expect(sentBody.status).toBe(404);
      expect(sentBody.detail).toBe('Resource not found');
    });

    it('should handle HttpException with object response (message string)', () => {
      const exception = new HttpException(
        { message: 'Email already exists', statusCode: 409 },
        HttpStatus.CONFLICT,
      );

      filter.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.status).toBe(409);
      expect(sentBody.title).toBe('Conflict');
      expect(sentBody.detail).toBe('Email already exists');
    });

    it('should handle HttpException with validation pipe array messages', () => {
      const exception = new HttpException(
        {
          message: ['email must be valid', 'name is required'],
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.status).toBe(400);
      expect(sentBody.detail).toBe('Validation failed');
      expect(sentBody.errors).toEqual([
        'email must be valid',
        'name is required',
      ]);
    });

    it('should set instance from request URL', () => {
      const request = createMockRequest('/api/v1/products/5');
      const host = createMockArgumentsHost(request, mockResponse);
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.instance).toBe('/api/v1/products/5');
    });
  });

  describe('generic Error handling', () => {
    it('should convert a generic Error to 500 RFC 7807 response', () => {
      const exception = new Error('Something broke internally');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.type).toBe('about:blank');
      expect(sentBody.title).toBe('Internal Server Error');
      expect(sentBody.status).toBe(500);
    });

    it('should expose error message in non-production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = new Error('Database connection failed');
      filter.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.detail).toBe('Database connection failed');

      process.env.NODE_ENV = originalEnv;
    });

    it('should mask error message in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const exception = new Error('Sensitive database error details');
      filter.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.detail).toBe('An unexpected error occurred');
      expect(sentBody.detail).not.toContain('Sensitive');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle non-Error thrown values (string)', () => {
      filter.catch('something unexpected', mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.title).toBe('Internal Server Error');
    });
  });

  describe('stack trace control', () => {
    it('should include stack trace when includeStackTrace is true and not production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const filterWithStack = new Rfc7807ExceptionFilter(undefined, {
        includeStackTrace: true,
      });

      const exception = new NotFoundProblem({ detail: 'test' });
      filterWithStack.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.stackTrace).toBeDefined();
      expect(typeof sentBody.stackTrace).toBe('string');

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT include stack trace in production even if includeStackTrace is true', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const filterWithStack = new Rfc7807ExceptionFilter(undefined, {
        includeStackTrace: true,
      });

      const exception = new NotFoundProblem({ detail: 'test' });
      filterWithStack.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.stackTrace).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT include stack trace when includeStackTrace is false', () => {
      const filterNoStack = new Rfc7807ExceptionFilter(undefined, {
        includeStackTrace: false,
      });

      const exception = new NotFoundProblem({ detail: 'test' });
      filterNoStack.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.stackTrace).toBeUndefined();
    });
  });

  describe('onProblem callback', () => {
    it('should invoke onProblem with the problem detail and exception', () => {
      const onProblem = jest.fn();
      const filterWithCallback = new Rfc7807ExceptionFilter(undefined, {
        onProblem,
      });

      const exception = new NotFoundProblem({ detail: 'User not found' });
      filterWithCallback.catch(exception, mockHost);

      expect(onProblem).toHaveBeenCalledTimes(1);
      const [problem, receivedException] = onProblem.mock.calls[0];
      expect(problem.status).toBe(404);
      expect(problem.title).toBe('Not Found');
      expect(receivedException).toBe(exception);
    });

    it('should invoke onProblem for generic Errors too', () => {
      const onProblem = jest.fn();
      const filterWithCallback = new Rfc7807ExceptionFilter(undefined, {
        onProblem,
      });

      const exception = new Error('generic failure');
      filterWithCallback.catch(exception, mockHost);

      expect(onProblem).toHaveBeenCalledTimes(1);
      expect(onProblem.mock.calls[0][1]).toBe(exception);
    });

    it('should NOT invoke onProblem for non-Error thrown values', () => {
      const onProblem = jest.fn();
      const filterWithCallback = new Rfc7807ExceptionFilter(undefined, {
        onProblem,
      });

      filterWithCallback.catch('a string error', mockHost);

      expect(onProblem).not.toHaveBeenCalled();
    });
  });

  describe('custom serializer', () => {
    it('should use a custom serializer when provided', () => {
      const customSerializer: IProblemDetailSerializer = {
        contentType: 'application/problem+xml',
        serialize: (problem: IProblemDetail) =>
          `<problem><status>${problem.status}</status></problem>`,
      };

      const filterWithCustom = new Rfc7807ExceptionFilter(customSerializer, {});

      const exception = new NotFoundProblem();
      filterWithCustom.catch(exception, mockHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+xml',
      );
      expect(mockResponse.send.mock.calls[0][0]).toContain(
        '<status>404</status>',
      );
    });
  });

  describe('typeBaseUri configuration', () => {
    it('should apply typeBaseUri to ProblemDetailException with default type', () => {
      const filterWithBaseUri = new Rfc7807ExceptionFilter(undefined, {
        typeBaseUri: 'https://api.example.com/errors',
      });

      const exception = new NotFoundProblem({ detail: 'test' });
      filterWithBaseUri.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.type).toBe('https://api.example.com/errors/not-found');
    });

    it('should NOT override explicit type URI on ProblemDetailException', () => {
      const filterWithBaseUri = new Rfc7807ExceptionFilter(undefined, {
        typeBaseUri: 'https://api.example.com/errors',
      });

      const exception = new NotFoundProblem({
        type: 'https://custom.example.com/my-error',
        detail: 'test',
      });
      filterWithBaseUri.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.type).toBe('https://custom.example.com/my-error');
    });

    it('should apply typeBaseUri to HttpException conversions', () => {
      const filterWithBaseUri = new Rfc7807ExceptionFilter(undefined, {
        typeBaseUri: 'https://api.example.com/errors',
      });

      const exception = new HttpException('test', HttpStatus.FORBIDDEN);
      filterWithBaseUri.catch(exception, mockHost);

      const sentBody = JSON.parse(mockResponse.send.mock.calls[0][0]);
      expect(sentBody.type).toBe('https://api.example.com/errors/forbidden');
    });
  });

  describe('content type header', () => {
    it('should always set Content-Type to application/problem+json by default', () => {
      const exception = new Error('test');
      filter.catch(exception, mockHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
    });
  });
});
