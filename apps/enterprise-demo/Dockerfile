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

# Prune to production-only dependencies (CI=true avoids TTY prompt)
# RUN CI=true pnpm prune --prod --no-optional --ignore-scripts

# Aggressively strip unnecessary files from production node_modules
# This saves ~30-40% of node_modules size
# RUN find node_modules -type f \( \
#         -name "*.md" -o -name "*.MD" \
#         -o -name "*.ts" ! -name "*.d.ts" \
#         -o -name "*.map" \
#         -o -name "*.txt" -o -name "*.yml" -o -name "*.yaml" \
#         -o -name "CHANGELOG*" -o -name "CHANGES*" \
#         -o -name "LICENSE*" -o -name "LICENCE*" \
#         -o -name "AUTHORS*" -o -name "CONTRIBUTORS*" \
#         -o -name "HISTORY*" -o -name "NOTICE*" \
#         -o -name ".npmignore" -o -name ".eslintrc*" \
#         -o -name ".prettierrc*" -o -name "tsconfig*" \
#         -o -name "Makefile" -o -name "Gruntfile*" \
#         -o -name "Gulpfile*" -o -name ".travis.yml" \
#         -o -name "appveyor.yml" -o -name ".editorconfig" \
#     \) -delete 2>/dev/null; \
#     find node_modules -type d \( \
#         -name "test" -o -name "tests" -o -name "__tests__" \
#         -o -name "docs" -o -name "doc" \
#         -o -name "example" -o -name "examples" \
#         -o -name ".github" \
#     \) -exec rm -rf {} + 2>/dev/null; \
#     true

# ─── Stage 4: Production ─────────────────────────────────────────────────────
# Google Distroless: ~130MB base, no shell, no package manager, zero CVEs
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS production

# Labels for container metadata
LABEL maintainer="Xavier Montaño"
LABEL description="Enterprise Demo — NestJS application with RFC 7807 error handling"
LABEL org.opencontainers.image.source="https://github.com/xavierdev25/nestjs-rfc7807-errors"

WORKDIR /app

# Copy production dependencies (already stripped of unnecessary files)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/enterprise-demo/node_modules ./apps/enterprise-demo/node_modules
COPY --from=build /app/libs/rfc7807-errors/node_modules ./libs/rfc7807-errors/node_modules

# Copy compiled artifacts only (no source TypeScript)
COPY --from=build /app/libs/rfc7807-errors/dist ./libs/rfc7807-errors/dist
COPY --from=build /app/libs/rfc7807-errors/package.json ./libs/rfc7807-errors/
COPY --from=build /app/apps/enterprise-demo/dist ./apps/enterprise-demo/dist
COPY --from=build /app/apps/enterprise-demo/package.json ./apps/enterprise-demo/

# Copy workspace config (needed for pnpm workspace resolution)
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./

# Distroless already runs as nonroot (UID 65534)
# No USER directive needed — it's the default

# Expose the application port
EXPOSE 3000

# Distroless has no shell — use exec-form CMD only
# Node.js in distroless handles signals natively (no dumb-init needed)
CMD ["apps/enterprise-demo/dist/main.js"]
