# ==============================================================================
# Enterprise Demo — Multi-stage Dockerfile
#
# Stages:
#   1. base       — Alpine Node.js with pnpm (build toolchain)
#   2. deps       — Install ALL dependencies (including devDependencies)
#   3. build      — TypeScript compilation + dependency pruning + cleanup
#   4. production — Google Distroless Node.js 20 (minimal attack surface)
#
# Build:
#   docker build -f apps/enterprise-demo/Dockerfile -t enterprise-demo .
#
# Security:
#   - Distroless: no shell, no package manager, no OS utilities
#   - Non-root user (nonroot:65534)
#   - No dev dependencies in production
#   - Zero CVE base image (no OS packages to patch)
# ==============================================================================

# ─── Stage 1: Base ────────────────────────────────────────────────────────────
# Node 22 Alpine with pnpm for dependency installation and TypeScript build
# (Build stages use Node 22; production uses Node 20 distroless for minimal size)
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Stage 2: Dependencies ───────────────────────────────────────────────────
# Install ALL dependencies (including dev) needed for the build stage
FROM base AS deps

# Copy workspace config files first (cache layer optimization)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json for each workspace package
COPY apps/enterprise-demo/package.json ./apps/enterprise-demo/
COPY libs/rfc7807-errors/package.json ./libs/rfc7807-errors/

# Install all dependencies (including devDependencies for build)
# --ignore-scripts: skip native addon builds (not needed for TS compilation)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ─── Stage 3: Build ──────────────────────────────────────────────────────────
# Compile TypeScript to JavaScript and prepare minimal production deps
FROM deps AS build

# Copy source code
COPY tsconfig.json tsconfig.build.json ./
COPY libs/rfc7807-errors/ ./libs/rfc7807-errors/
COPY apps/enterprise-demo/ ./apps/enterprise-demo/

# Build the library first (it's a dependency of the app)
RUN cd libs/rfc7807-errors && pnpm build

# Build the application
RUN cd apps/enterprise-demo && pnpm build

# Produce a self-contained, production-only deployment of the app.
#
# `pnpm prune --prod` does NOT work cleanly here: pnpm's node_modules is a tree
# of symlinks into the virtual store, and copying that into distroless breaks
# module resolution (Cannot find module '@nestjs/core'). `pnpm deploy` instead
# materializes a flat, dependency-complete node_modules with ZERO
# devDependencies and the workspace lib injected as real files — exactly what a
# minimal runtime image needs.
# --no-optional drops TypeORM's optional native drivers (better-sqlite3, sqlite3,
# …) which this app never uses (it runs on `pg`, pure JS). That both avoids their
# native build-script gate and trims the image.
RUN pnpm --filter=@xavierdev25/enterprise-demo deploy \
    --prod --legacy --no-optional /prod/app

# ─── Stage 4: Production ─────────────────────────────────────────────────────
# Google Distroless: ~130MB base, no shell, no package manager, minimal CVEs
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS production

# Labels for container metadata
LABEL maintainer="Xavier Montaño"
LABEL description="Enterprise Demo — NestJS application with RFC 7807 error handling"
LABEL org.opencontainers.image.source="https://github.com/xavierdev25/nestjs-rfc7807-errors"

WORKDIR /app

# Copy the deployed app (its package root): dist + a flat prod-only node_modules.
COPY --from=build /prod/app ./

# Distroless already runs as nonroot (UID 65534)
# No USER directive needed — it's the default

# Expose the application port
EXPOSE 3000

# Distroless has no shell — use exec-form CMD only
# Node.js in distroless handles signals natively (no dumb-init needed)
CMD ["dist/main.js"]
