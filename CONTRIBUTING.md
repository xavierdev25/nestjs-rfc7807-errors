# Contributing

Thanks for your interest in improving `@xavierdev25/rfc7807-errors`! 🎉
Contributions of all kinds are welcome — bug reports, docs, tests, and features.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating,
you agree to uphold it.

## Prerequisites

- **Node.js 22+**
- **pnpm 11+** (`corepack enable` will use the pinned version automatically)
- **Docker** (optional — only needed for the end-to-end tests)

## Getting started

```bash
git clone https://github.com/xavierdev25/nestjs-rfc7807-errors.git
cd nestjs-rfc7807-errors
pnpm install
```

## Project layout

This is a pnpm monorepo. **The published package is the library** — most
contributions belong there.

| Path | Description |
| --- | --- |
| `libs/rfc7807-errors` | 📦 The npm package (the product). |
| `apps/enterprise-demo` | A reference NestJS app used as an end-to-end test bed. |

## Running the checks

```bash
pnpm -r build                       # build library + app
pnpm --filter @xavierdev25/rfc7807-errors test    # library unit tests (must stay >90% coverage)
pnpm lint                           # ESLint (+ Prettier)
pnpm --filter @xavierdev25/enterprise-demo test:e2e   # e2e (needs PostgreSQL; see docker-compose.yml)
```

The same checks run in CI on every pull request.

## Adding a new error mapper

The filter resolves problems through an ordered chain of `ExceptionMapper`s.
To support a new error source (e.g. another ORM or SDK):

1. Implement `ExceptionMapper` (return `null` to defer to the next mapper).
2. Add it via `Rfc7807Module.forRoot({ mappers: [yourMapper] })`, or — if it's a
   built-in — wire it into the filter and cover it with tests.

## Coding standards

- **TypeScript**, strict where it matters; keep the library **dependency-light**
  (detect external errors by shape/code, don't hard-depend on TypeORM/Prisma/etc.).
- **ESLint + Prettier** are enforced (`pnpm lint`).
- Tests follow **F.I.R.S.T.**; new code needs tests (the library enforces ≥90% coverage).
- Commit messages follow **[Conventional Commits](https://www.conventionalcommits.org/)**
  (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

## Pull request flow

1. Fork and create a branch from `main` (`feat/my-feature`).
2. Make your change **with tests** and update the docs / `CHANGELOG.md` (Unreleased).
3. Ensure `pnpm -r build`, tests, and `pnpm lint` pass.
4. Open a PR against `main` with a clear description.

## Releasing (maintainers)

1. Move the relevant `CHANGELOG.md` entries under a new version heading.
2. Bump `version` in `libs/rfc7807-errors/package.json`.
3. Merge to `main`, then tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
   (the publish workflow releases to npm).

Thank you for contributing! 💙
