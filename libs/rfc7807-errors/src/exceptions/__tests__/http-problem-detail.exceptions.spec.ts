import { ProblemDetailException } from '../problem-detail.exception';
import {
  BadRequestProblem,
  UnauthorizedProblem,
  ForbiddenProblem,
  NotFoundProblem,
  ConflictProblem,
  UnprocessableEntityProblem,
  TooManyRequestsProblem,
  InternalServerErrorProblem,
} from '../http-problem-detail.exceptions';

/**
 * Test matrix: each concrete exception must have the correct
 * pre-configured status, title, and be an instance of the base class.
 */
const EXCEPTION_TEST_CASES = [
  {
    ExceptionClass: BadRequestProblem,
    expectedStatus: 400,
    expectedTitle: 'Bad Request',
  },
  {
    ExceptionClass: UnauthorizedProblem,
    expectedStatus: 401,
    expectedTitle: 'Unauthorized',
  },
  {
    ExceptionClass: ForbiddenProblem,
    expectedStatus: 403,
    expectedTitle: 'Forbidden',
  },
  {
    ExceptionClass: NotFoundProblem,
    expectedStatus: 404,
    expectedTitle: 'Not Found',
  },
  {
    ExceptionClass: ConflictProblem,
    expectedStatus: 409,
    expectedTitle: 'Conflict',
  },
  {
    ExceptionClass: UnprocessableEntityProblem,
    expectedStatus: 422,
    expectedTitle: 'Unprocessable Entity',
  },
  {
    ExceptionClass: TooManyRequestsProblem,
    expectedStatus: 429,
    expectedTitle: 'Too Many Requests',
  },
  {
    ExceptionClass: InternalServerErrorProblem,
    expectedStatus: 500,
    expectedTitle: 'Internal Server Error',
  },
] as const;

describe('HTTP Problem Detail Exceptions', () => {
  describe.each(EXCEPTION_TEST_CASES)(
    '$ExceptionClass.name',
    ({ ExceptionClass, expectedStatus, expectedTitle }) => {
      it(`should have status ${expectedStatus}`, () => {
        const exception = new ExceptionClass();
        expect(exception.status).toBe(expectedStatus);
      });

      it(`should have title "${expectedTitle}"`, () => {
        const exception = new ExceptionClass();
        expect(exception.title).toBe(expectedTitle);
      });

      it('should default type to "about:blank"', () => {
        const exception = new ExceptionClass();
        expect(exception.type).toBe('about:blank');
      });

      it('should be an instance of ProblemDetailException', () => {
        const exception = new ExceptionClass();
        expect(exception).toBeInstanceOf(ProblemDetailException);
      });

      it('should be an instance of Error', () => {
        const exception = new ExceptionClass();
        expect(exception).toBeInstanceOf(Error);
      });

      it('should accept a detail message', () => {
        const exception = new ExceptionClass({
          detail: 'Something went wrong here',
        });
        expect(exception.detail).toBe('Something went wrong here');
      });

      it('should accept an instance URI', () => {
        const exception = new ExceptionClass({
          instance: '/api/v1/resource/42',
        });
        expect(exception.instance).toBe('/api/v1/resource/42');
      });

      it('should accept a custom type URI', () => {
        const exception = new ExceptionClass({
          type: 'https://errors.example.com/custom-type',
        });
        expect(exception.type).toBe('https://errors.example.com/custom-type');
      });

      it('should accept extension members', () => {
        const exception = new ExceptionClass({
          extensions: {
            correlationId: 'req-abc-123',
            timestamp: '2026-01-01T00:00:00Z',
          },
        });

        expect(exception.extensions).toEqual({
          correlationId: 'req-abc-123',
          timestamp: '2026-01-01T00:00:00Z',
        });
      });

      it('should produce a valid toProblemDetail() with extensions spread', () => {
        const exception = new ExceptionClass({
          detail: 'test detail',
          extensions: { retryAfter: 60 },
        });

        const problem = exception.toProblemDetail();

        expect(problem.status).toBe(expectedStatus);
        expect(problem.title).toBe(expectedTitle);
        expect(problem.detail).toBe('test detail');
        expect(problem.retryAfter).toBe(60);
      });
    },
  );

  describe('constructor defaults', () => {
    it('should construct without any arguments', () => {
      const exception = new NotFoundProblem();

      expect(exception.status).toBe(404);
      expect(exception.title).toBe('Not Found');
      expect(exception.detail).toBeUndefined();
      expect(exception.instance).toBeUndefined();
      expect(exception.extensions).toEqual({});
    });
  });
});
