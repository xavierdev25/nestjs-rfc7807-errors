# @xavierdev25/rfc7807-errors

> A global exception engine for **NestJS** that turns every API error into the **RFC 7807 Problem Details** standard (`application/problem+json`) — generic errors, validation errors, **and database driver errors** — with zero boilerplate.

<p>
  <a href="https://www.npmjs.com/package/@xavierdev25/rfc7807-errors"><img src="https://img.shields.io/npm/v/@xavierdev25/rfc7807-errors.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@xavierdev25/rfc7807-errors"><img src="https://img.shields.io/npm/dm/@xavierdev25/rfc7807-errors.svg" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@xavierdev25/rfc7807-errors.svg" alt="license"></a>
  <a href="https://github.com/xavierdev25/nestjs-rfc7807-errors/actions/workflows/ci.yml"><img src="https://github.com/xavierdev25/nestjs-rfc7807-errors/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

## The problem

Every team reinvents error responses. One endpoint returns `{ "message": "Error" }`,
another `{ "error": true, "code": 400 }`, and once you hit microservices the
frontend drowns in inconsistent shapes. There **is** a standard for this —
[RFC 7807 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807) —
but wiring it into NestJS means writing custom exception filters in every project
and hand-mapping validation, domain, and database errors.

## The solution

Install it, register one module, and **every error your API throws** is converted
to a single, standard, machine-readable shape:

```json
{
  "type": "https://api.example.com/errors/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "A resource with the same unique value already exists.",
  "instance": "/users"
}
```

## Install

```bash
npm install @xavierdev25/rfc7807-errors
# peers: @nestjs/common, @nestjs/core, rxjs (already in your NestJS app)
```

## Quick start

```ts
// app.module.ts — registers the global filter for you (APP_FILTER)
import { Rfc7807Module } from '@xavierdev25/rfc7807-errors';

@Module({ imports: [Rfc7807Module.forRoot()] })
export class AppModule {}
```

```ts
// main.ts — (optional) turn class-validator failures into RFC 7807 too
import { ValidationPipe } from '@nestjs/common';
import { rfc7807ValidationExceptionFactory } from '@xavierdev25/rfc7807-errors';

app.useGlobalPipes(
  new ValidationPipe({ exceptionFactory: rfc7807ValidationExceptionFactory }),
);
```

That's it. From now on:

- `throw new NotFoundProblem({ detail: '…' })` → `404 application/problem+json`
- a validation failure → `400` with a structured `violations` array
- a **TypeORM/Prisma/PostgreSQL** unique violation → `409` — **no `try/catch`**
- any unhandled error → `500`, masked in production

## Features

- ✅ **8 ready-made HTTP exceptions** (400/401/403/404/409/422/429/500) + an abstract base for your own domain errors.
- ✅ **Automatic database error mapping** (TypeORM / Prisma / raw `pg`) — dependency-free, detail **masked in production**.
- ✅ **class-validator** integration via a drop-in `exceptionFactory` (structured `violations`).
- ✅ **Extensible mapper chain** — map errors from gRPC, SDKs, any ORM without forking (Open/Closed).
- ✅ Framework-agnostic filter (Express/Fastify), pluggable serializer (DIP), and an `onProblem` hook for **Sentry / metrics**.
- ✅ Sync & async configuration (`forRoot` / `forRootAsync`).
- ✅ **135+ unit tests**, SOLID design, fully typed.

👉 **Full library docs:** [`libs/rfc7807-errors/README.md`](./libs/rfc7807-errors/README.md)

## Repository layout

This is a pnpm monorepo. **The published package is the library**; the app is a
reference, not part of the dependency.

| Path | What it is |
| --- | --- |
| [`libs/rfc7807-errors`](./libs/rfc7807-errors) | 📦 **The product** — the published npm package. |
| [`apps/enterprise-demo`](./apps/enterprise-demo) | A reference NestJS app that integrates the library against real TypeORM + PostgreSQL (used as an end-to-end test bed). |

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md). See the [CHANGELOG](./CHANGELOG.md) for
release history.

## License

[MIT](./LICENSE) © Xavier Montaño — free and open source.
