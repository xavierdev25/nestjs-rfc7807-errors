import {
  flattenValidationErrors,
  rfc7807ValidationExceptionFactory,
} from '../rfc7807-validation';
import { BadRequestProblem } from '../../exceptions/http-problem-detail.exceptions';

describe('rfc7807 validation', () => {
  describe('flattenValidationErrors', () => {
    it('flattens a top-level error into field/constraints/value', () => {
      const violations = flattenValidationErrors([
        {
          property: 'email',
          value: 'not-an-email',
          constraints: { isEmail: 'email must be an email' },
        },
      ]);
      expect(violations).toEqual([
        {
          field: 'email',
          constraints: ['email must be an email'],
          value: 'not-an-email',
        },
      ]);
    });

    it('flattens nested children with a dot-path', () => {
      const violations = flattenValidationErrors([
        {
          property: 'address',
          children: [
            {
              property: 'zipCode',
              value: 'X',
              constraints: { isPostalCode: 'invalid zip' },
            },
          ],
        },
      ]);
      expect(violations).toEqual([
        { field: 'address.zipCode', constraints: ['invalid zip'], value: 'X' },
      ]);
    });
  });

  describe('rfc7807ValidationExceptionFactory', () => {
    it('returns a 400 BadRequestProblem carrying violations', () => {
      const ex = rfc7807ValidationExceptionFactory([
        { property: 'amount', constraints: { isPositive: 'must be positive' } },
      ]);
      expect(ex).toBeInstanceOf(BadRequestProblem);

      const problem = ex.toProblemDetail();
      expect(problem.status).toBe(400);
      expect(problem.title).toBe('Bad Request');
      expect(problem.violations).toEqual([
        { field: 'amount', constraints: ['must be positive'], value: undefined },
      ]);
    });
  });
});
