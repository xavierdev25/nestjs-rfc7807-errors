# Changelog

All notable changes to `@xavierdev25/rfc7807-errors` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- i18n of error `title` / `detail` via an `Accept-Language`-aware translator.
- First-class Sentry adapter (on top of the existing `onProblem` hook).

## [0.2.0]

### Added

- **Automatic database error mapping** (`DatabaseExceptionMapper`): TypeORM
  `QueryFailedError`, Prisma `PrismaClientKnownRequestError`, and the raw `pg`
  driver are detected by error shape (no hard dependency) and mapped to the
  correct status — e.g. PostgreSQL `23505` → `409`, `23502` → `422`, Prisma
  `P2002` → `409`, `P2025` → `404`. Driver detail is masked in production.
- **`rfc7807ValidationExceptionFactory`**: a drop-in `ValidationPipe`
  `exceptionFactory` that turns class-validator errors into a `BadRequestProblem`
  with a structured `violations` array (nested DTOs flattened to a dot-path).
- **Extensible mapper chain**: a public `ExceptionMapper` interface and a
  `mappers` module option to map any error source (gRPC, SDKs, other ORMs)
  before the built-ins — Open/Closed, no fork required.
- `databaseErrors` module option (default `true`) to toggle DB error mapping.

### Changed

- The exception filter was refactored from hardcoded branches into an ordered
  **Chain of Responsibility** of mappers, keeping it open for extension.

## [0.1.0]

### Added

- Initial release.
- `Rfc7807ExceptionFilter`: a framework-agnostic global filter that serializes
  any exception to `application/problem+json`.
- Abstract `ProblemDetailException` base plus eight concrete HTTP exceptions:
  `BadRequestProblem` (400), `UnauthorizedProblem` (401), `ForbiddenProblem`
  (403), `NotFoundProblem` (404), `ConflictProblem` (409),
  `UnprocessableEntityProblem` (422), `TooManyRequestsProblem` (429),
  `InternalServerErrorProblem` (500).
- `IProblemDetailSerializer` (DIP) with a default `JsonProblemDetailSerializer`.
- `Rfc7807Module` with `forRoot` / `forRootAsync` and options: `typeBaseUri`,
  `includeStackTrace`, `onProblem`, `serializer`.
- Production-safe masking of unexpected errors.

[Unreleased]: https://github.com/xavierdev25/nestjs-rfc7807-errors/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/xavierdev25/nestjs-rfc7807-errors/releases/tag/v0.2.0
[0.1.0]: https://github.com/xavierdev25/nestjs-rfc7807-errors/releases/tag/v0.1.0
