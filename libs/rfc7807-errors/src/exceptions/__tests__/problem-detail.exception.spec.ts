import {
  ProblemDetailException,
  ProblemDetailParams,
} from '../problem-detail.exception';
import { IProblemDetail } from '../../interfaces/problem-detail.interface';

/**
 * Concrete implementation for testing the abstract base class.
 */
class TestProblemException extends ProblemDetailException {
  constructor(params: ProblemDetailParams) {
    super(params);
  }
}

describe('ProblemDetailException', () => {
  describe('constructor', () => {
    it('should construct with minimal required fields (title and status)', () => {
      const exception = new TestProblemException({
        title: 'Test Error',
        status: 400,
      });

      expect(exception.title).toBe('Test Error');
      expect(exception.status).toBe(400);
      expect(exception.type).toBe('about:blank');
      expect(exception.detail).toBeUndefined();
      expect(exception.instance).toBeUndefined();
      expect(exception.extensions).toEqual({});
    });

    it('should construct with all optional fields populated', () => {
      const exception = new TestProblemException({
        type: 'https://example.com/errors/validation',
        title: 'Validation Error',
        status: 422,
        detail: 'The email field is invalid',
        instance: '/api/v1/users/42',
      });

      expect(exception.type).toBe('https://example.com/errors/validation');
      expect(exception.title).toBe('Validation Error');
      expect(exception.status).toBe(422);
      expect(exception.detail).toBe('The email field is invalid');
      expect(exception.instance).toBe('/api/v1/users/42');
    });

    it('should accept arbitrary extension members', () => {
      const exception = new TestProblemException({
        title: 'Validation Error',
        status: 422,
        extensions: {
          errors: [
            { field: 'email', message: 'must be a valid email' },
            { field: 'age', message: 'must be positive' },
          ],
          retryAfter: 30,
          correlationId: 'abc-123',
        },
      });

      expect(exception.extensions).toEqual({
        errors: [
          { field: 'email', message: 'must be a valid email' },
          { field: 'age', message: 'must be positive' },
        ],
        retryAfter: 30,
        correlationId: 'abc-123',
      });
    });

    it('should default type to "about:blank" when not provided', () => {
      const exception = new TestProblemException({
        title: 'Some Error',
        status: 500,
      });

      expect(exception.type).toBe('about:blank');
    });

    it('should use detail as Error message when detail is provided', () => {
      const exception = new TestProblemException({
        title: 'Not Found',
        status: 404,
        detail: 'User 42 was not found',
      });

      expect(exception.message).toBe('User 42 was not found');
    });

    it('should use title as Error message when detail is not provided', () => {
      const exception = new TestProblemException({
        title: 'Not Found',
        status: 404,
      });

      expect(exception.message).toBe('Not Found');
    });
  });

  describe('inheritance', () => {
    it('should be an instance of Error', () => {
      const exception = new TestProblemException({
        title: 'Test',
        status: 400,
      });

      expect(exception).toBeInstanceOf(Error);
    });

    it('should be an instance of ProblemDetailException', () => {
      const exception = new TestProblemException({
        title: 'Test',
        status: 400,
      });

      expect(exception).toBeInstanceOf(ProblemDetailException);
    });

    it('should have the correct constructor name', () => {
      const exception = new TestProblemException({
        title: 'Test',
        status: 400,
      });

      expect(exception.name).toBe('TestProblemException');
    });

    it('should have a stack trace', () => {
      const exception = new TestProblemException({
        title: 'Test',
        status: 400,
      });

      expect(exception.stack).toBeDefined();
      expect(typeof exception.stack).toBe('string');
    });
  });

  describe('toProblemDetail()', () => {
    it('should return an IProblemDetail with standard fields', () => {
      const exception = new TestProblemException({
        type: 'https://api.example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'The requested resource does not exist',
        instance: '/api/v1/orders/999',
      });

      const problem: IProblemDetail = exception.toProblemDetail();

      expect(problem).toEqual({
        type: 'https://api.example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'The requested resource does not exist',
        instance: '/api/v1/orders/999',
      });
    });

    it('should omit undefined optional fields', () => {
      const exception = new TestProblemException({
        title: 'Bad Request',
        status: 400,
      });

      const problem = exception.toProblemDetail();

      expect(problem).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
      });
      expect('detail' in problem).toBe(false);
      expect('instance' in problem).toBe(false);
    });

    it('should spread extension members at the top level', () => {
      const exception = new TestProblemException({
        title: 'Conflict',
        status: 409,
        extensions: {
          conflictingResource: '/api/v1/users/42',
          suggestedAction: 'retry-with-new-version',
        },
      });

      const problem = exception.toProblemDetail();

      expect(problem.conflictingResource).toBe('/api/v1/users/42');
      expect(problem.suggestedAction).toBe('retry-with-new-version');
    });

    it('should return a new object on each call (no aliasing)', () => {
      const exception = new TestProblemException({
        title: 'Test',
        status: 400,
      });

      const first = exception.toProblemDetail();
      const second = exception.toProblemDetail();

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });
});
