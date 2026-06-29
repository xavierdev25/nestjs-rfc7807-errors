# @xavierdev25/rfc7807-errors

> Global NestJS exception filter implementing **RFC 7807 Problem Details** (`application/problem+json`) for HTTP APIs.

Turns every error your API throws — your own domain errors, NestJS `HttpException`s, and unexpected crashes — into a single, standard, machine-readable error shape:

```json
{
  "type": "https://api.example.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Transaction with ID '…' was not found.",
  "instance": "/transactions/123",
  "transactionId": "123"
}
```

Built with SOLID in mind: an abstract `ProblemDetailException`, eight concrete LSP-correct subclasses, a framework-agnostic filter (Express/Fastify via `HttpAdapterHost`), and a pluggable serializer (DIP).

## Install

```bash
pnpm add @xavierdev25/rfc7807-errors
# peer deps: @nestjs/common, @nestjs/core, rxjs
```

## Quick start

```ts
import { Module } from '@nestjs/common';
import { Rfc7807Module } from '@xavierdev25/rfc7807-errors';

@Module({
  imports: [
    Rfc7807Module.forRoot({
      // Type URIs become `${typeBaseUri}/${error-slug}` (default: 'about:blank')
      typeBaseUri: 'https://api.example.com/errors',
      // Stack traces are added only when NODE_ENV !== 'production'
      includeStackTrace: process.env.NODE_ENV !== 'production',
      // Hook for logging / metrics / error tracking
      onProblem: (problem, exception) => logger.error(problem.title, exception),
    }),
  ],
})
export class AppModule {}
```

`forRoot` registers the `Rfc7807ExceptionFilter` globally (`APP_FILTER`). No manual `useGlobalFilters` needed.

## Throwing problems

Eight ready-made exceptions, one per common HTTP status:

| Class | Status |
| --- | --- |
| `BadRequestProblem` | 400 |
| `UnauthorizedProblem` | 401 |
| `ForbiddenProblem` | 403 |
| `NotFoundProblem` | 404 |
| `ConflictProblem` | 409 |
| `UnprocessableEntityProblem` | 422 |
| `TooManyRequestsProblem` | 429 |
| `InternalServerErrorProblem` | 500 |

```ts
import { ConflictProblem } from '@xavierdev25/rfc7807-errors';

throw new ConflictProblem({
  detail: 'A transaction with this idempotency key already exists.',
  instance: request.url, // optional; the filter fills it from the request URL
  extensions: { idempotencyKey }, // any extra members are merged into the body
});
```

### Custom domain errors

Subclass a problem so your domain layer throws meaningful, typed errors that still serialize to RFC 7807:

```ts
import { NotFoundProblem } from '@xavierdev25/rfc7807-errors';

export class TransactionNotFoundError extends NotFoundProblem {
  constructor(id: string) {
    super({
      type: 'https://api.example.com/errors/transaction-not-found',
      detail: `Transaction with ID '${id}' was not found.`,
      extensions: { transactionId: id },
    });
  }
}
```

## Async configuration

```ts
Rfc7807Module.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    typeBaseUri: config.get('ERRORS_BASE_URI'),
    includeStackTrace: config.get('NODE_ENV') !== 'production',
  }),
});
```

`useClass` and `useExisting` (via `Rfc7807OptionsFactory`) are also supported.

## Automatic database error mapping

Database driver errors are translated to a **meaningful HTTP status** out of the
box — no `try/catch` in your controllers. It's **dependency-free** (detection is
by error shape/code), so it works whether you use **TypeORM**, **Prisma**, or the
raw **`pg`** driver. Sensitive driver detail (constraint/column/message) is
**masked in production** and only attached (under a `dbError` member) outside it.

| Source | Code | → Problem |
| --- | --- | --- |
| PostgreSQL | `23505` unique_violation | `409 Conflict` |
| PostgreSQL | `23503` foreign_key_violation | `409 Conflict` |
| PostgreSQL | `23502` not_null_violation | `422 Unprocessable Entity` |
| PostgreSQL | `22P02` invalid_text_representation | `400 Bad Request` |
| Prisma | `P2002` unique | `409` · `P2025` not found → `404` · `P2003` FK → `409` |

Enabled by default; disable with `databaseErrors: false`.

## Validation errors (class-validator)

Drop the provided `exceptionFactory` into NestJS's `ValidationPipe` and every
class-validator failure becomes a `400 BadRequestProblem` with a structured
`violations` array (field, constraints, value — nested DTOs flattened to a
dot-path):

```ts
import { ValidationPipe } from '@nestjs/common';
import { rfc7807ValidationExceptionFactory } from '@xavierdev25/rfc7807-errors';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: rfc7807ValidationExceptionFactory,
  }),
);
```

## Custom mappers (extend to any error source)

Need to map errors from gRPC, a third-party SDK, or another ORM? Implement
`ExceptionMapper` and register it — it runs **before** the built-ins, so you can
also override them (Open/Closed, no fork required):

```ts
import { ExceptionMapper } from '@xavierdev25/rfc7807-errors';

const stripeMapper: ExceptionMapper = {
  map: (e) =>
    e?.constructor?.name === 'StripeCardError'
      ? { type: 'about:blank', title: 'Payment Required', status: 402 }
      : null, // null → defer to the next mapper
};

Rfc7807Module.forRoot({ mappers: [stripeMapper] });
```

## What the filter handles (in order)

1. **Custom `mappers`** (yours) → run first; can override any built-in.
2. **`ProblemDetailException`** (yours) → serialized as-is via `toProblemDetail()`.
3. **NestJS `HttpException`** → mapped to RFC 7807 (validation arrays become an `errors` member).
4. **Database driver errors** (TypeORM/Prisma/PostgreSQL) → proper status (409/422/…).
5. **Anything else** → `500`, with the detail **masked** in production to avoid leaking internals.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `typeBaseUri` | `string` | `'about:blank'` | Prefix for the `type` URI (`{base}/{slug}`). |
| `databaseErrors` | `boolean` | `true` | Map DB driver errors (TypeORM/Prisma/PG) to HTTP statuses. |
| `mappers` | `ExceptionMapper[]` | `[]` | Custom mappers, tried before the built-ins. |
| `includeStackTrace` | `boolean` | `false` | Add `stackTrace` to the body (never in production). |
| `onProblem` | `(problem, exception) => void` | – | Side-effect hook (logging/metrics/error tracking, e.g. Sentry). |
| `serializer` | `IProblemDetailSerializer` | `JsonProblemDetailSerializer` | Custom output serializer (DIP). |

Content type: **`application/problem+json`**. See [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807).
