/**
 * Injection tokens for the Rfc7807 module.
 *
 * These tokens decouple the filter from concrete implementations,
 * enabling dependency injection of the serializer and module options.
 */

/** Injection token for Rfc7807ModuleOptions. */
export const RFC7807_OPTIONS = Symbol('RFC7807_OPTIONS');

/** Injection token for IProblemDetailSerializer. */
export const RFC7807_SERIALIZER = Symbol('RFC7807_SERIALIZER');
