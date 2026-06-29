import { JsonProblemDetailSerializer } from '../json-problem-detail.serializer';
import { IProblemDetail } from '../../interfaces/problem-detail.interface';

describe('JsonProblemDetailSerializer', () => {
  let serializer: JsonProblemDetailSerializer;

  beforeEach(() => {
    serializer = new JsonProblemDetailSerializer();
  });

  describe('contentType', () => {
    it('should have content type "application/problem+json"', () => {
      expect(serializer.contentType).toBe('application/problem+json');
    });
  });

  describe('serialize()', () => {
    it('should serialize a complete IProblemDetail to valid JSON', () => {
      const problem: IProblemDetail = {
        type: 'https://example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'User 42 was not found',
        instance: '/api/v1/users/42',
      };

      const result = serializer.serialize(problem);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        type: 'https://example.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'User 42 was not found',
        instance: '/api/v1/users/42',
      });
    });

    it('should serialize a minimal IProblemDetail (only required fields)', () => {
      const problem: IProblemDetail = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
      };

      const result = serializer.serialize(problem);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
      });
    });

    it('should omit undefined optional fields from the output', () => {
      const problem: IProblemDetail = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: undefined,
        instance: undefined,
      };

      const result = serializer.serialize(problem);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      });
      expect('detail' in parsed).toBe(false);
      expect('instance' in parsed).toBe(false);
    });

    it('should preserve extension members in the output', () => {
      const problem: IProblemDetail = {
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        errors: [
          { field: 'email', message: 'must be valid' },
          { field: 'name', message: 'is required' },
        ],
        correlationId: 'req-abc-123',
      };

      const result = serializer.serialize(problem);
      const parsed = JSON.parse(result);

      expect(parsed.errors).toEqual([
        { field: 'email', message: 'must be valid' },
        { field: 'name', message: 'is required' },
      ]);
      expect(parsed.correlationId).toBe('req-abc-123');
    });

    it('should maintain RFC 7807 field ordering (type, title, status first)', () => {
      const problem: IProblemDetail = {
        type: 'https://api.example.com/errors/conflict',
        title: 'Conflict',
        status: 409,
        detail: 'Resource version mismatch',
        instance: '/api/v1/orders/7',
        currentVersion: 3,
        requestedVersion: 1,
      };

      const result = serializer.serialize(problem);
      const keys = Object.keys(JSON.parse(result));

      // Standard fields should appear before extensions
      expect(keys[0]).toBe('type');
      expect(keys[1]).toBe('title');
      expect(keys[2]).toBe('status');
      expect(keys[3]).toBe('detail');
      expect(keys[4]).toBe('instance');
    });

    it('should produce a parseable JSON string', () => {
      const problem: IProblemDetail = {
        type: 'about:blank',
        title: 'Test',
        status: 500,
        detail: 'String with "quotes" and \n newlines',
      };

      const result = serializer.serialize(problem);

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle extension members with complex nested values', () => {
      const problem: IProblemDetail = {
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        validationErrors: {
          body: {
            email: ['must be a valid email', 'is required'],
            nested: { deep: { value: 42 } },
          },
        },
      };

      const result = serializer.serialize(problem);
      const parsed = JSON.parse(result);

      expect(parsed.validationErrors.body.email).toEqual([
        'must be a valid email',
        'is required',
      ]);
      expect(parsed.validationErrors.body.nested.deep.value).toBe(42);
    });

    it('should omit undefined extension members', () => {
      const problem: IProblemDetail = {
        type: 'about:blank',
        title: 'Test',
        status: 400,
        maybePresent: undefined,
        definitelyPresent: 'yes',
      };

      const result = serializer.serialize(problem);
      const parsed = JSON.parse(result);

      expect('maybePresent' in parsed).toBe(false);
      expect(parsed.definitelyPresent).toBe('yes');
    });
  });
});
