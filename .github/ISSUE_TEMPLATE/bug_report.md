---
name: Bug report
about: Something isn't mapping/serializing the way you expect
title: '[bug] '
labels: bug
---

## Describe the bug

A clear description of what happened vs. what you expected.

## Reproduction

Minimal steps or a code snippet (the thrown error + how the module is registered):

```ts
// e.g. Rfc7807Module.forRoot({ ... }) and the exception/route involved
```

## Actual response

```json
// the application/problem+json body you got (status + body)
```

## Expected response

```json
// what you expected instead
```

## Environment

- `@xavierdev25/rfc7807-errors` version:
- `@nestjs/common` / `@nestjs/core` version:
- ORM/driver (if DB-related): TypeORM / Prisma / pg — version:
- Node.js version:
