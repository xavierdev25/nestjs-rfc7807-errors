import { BadRequestProblem } from '../exceptions/http-problem-detail.exceptions';

/**
 * Structural shape of a class-validator `ValidationError`. Declared locally so
 * the library does not depend on `class-validator` — a real `ValidationError`
 * is assignable to this.
 */
export interface ValidationErrorLike {
  property: string;
  value?: unknown;
  constraints?: Record<string, string>;
  children?: ValidationErrorLike[];
}

/** One field's validation failure, RFC 7807 extension-friendly. */
export interface ValidationViolation {
  /** Dot-path of the field (e.g. `address.zipCode`). */
  field: string;
  /** Human-readable constraint messages that failed. */
  constraints: string[];
  /** The rejected value (omitted in the output if `undefined`). */
  value?: unknown;
}

/**
 * Flattens class-validator errors (including nested DTOs) into a flat list of
 * field violations with dot-path field names.
 */
export function flattenValidationErrors(
  errors: ValidationErrorLike[],
  parentPath = '',
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      violations.push({
        field: path,
        constraints: Object.values(error.constraints),
        value: error.value,
      });
    }

    if (error.children && error.children.length > 0) {
      violations.push(...flattenValidationErrors(error.children, path));
    }
  }

  return violations;
}

/**
 * Drop-in `exceptionFactory` for NestJS's `ValidationPipe`. Turns
 * class-validator failures into a `BadRequestProblem` (400) carrying a
 * structured `violations` array — which the global filter serializes as RFC
 * 7807. No extra wiring beyond:
 *
 * ```ts
 * import { rfc7807ValidationExceptionFactory } from '@xavierdev25/rfc7807-errors';
 *
 * app.useGlobalPipes(
 *   new ValidationPipe({
 *     whitelist: true,
 *     transform: true,
 *     exceptionFactory: rfc7807ValidationExceptionFactory,
 *   }),
 * );
 * ```
 */
export function rfc7807ValidationExceptionFactory(
  errors: ValidationErrorLike[],
): BadRequestProblem {
  const violations = flattenValidationErrors(errors);
  return new BadRequestProblem({
    detail: 'One or more fields failed validation.',
    extensions: { violations },
  });
}
