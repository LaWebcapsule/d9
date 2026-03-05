---
name: pnpm-ci-true-docker
description: Prevent pnpm 10+ Docker build failures by setting ENV CI=true to avoid TTY confirmation prompts.
version: 1.0.0
tags: [pnpm, docker, build, ci]
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
  reproducibility: always
  time_saved: 15m
---

# pnpm-ci-true-docker

## Purpose

Prevent Docker build failures caused by pnpm 10+ aborting with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` when running `pnpm install` in a non-TTY environment. The fix is to set `ENV CI=true` in the Dockerfile before any pnpm command.

## Triggers

- Writing or reviewing a Dockerfile that uses `pnpm install`, `pnpm deploy`, or any pnpm command with pnpm version 10 or later.
- Diagnosing a Docker build failure whose logs contain `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- Setting up a CI pipeline (GitHub Actions, GitLab CI, etc.) that runs pnpm 10+ without a TTY.

## Behavior

1. **Identify the pnpm version.** Check `package.json` > `packageManager` field, `pnpm-lock.yaml` header, or the Dockerfile base image to confirm pnpm >= 10 is in use.
2. **Add `ENV CI=true` in the Dockerfile.** Place it before the first `RUN` instruction that invokes pnpm. This tells pnpm to operate in non-interactive mode and skip any TTY confirmation prompts.
3. **Verify the build passes.** Run `docker build` and confirm the pnpm install step completes without the TTY error.

### Minimal Fix

```dockerfile
# Before any pnpm command
ENV CI=true

RUN pnpm install --frozen-lockfile
```

### Full Dockerfile Example

```dockerfile
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Critical: pnpm 10+ requires this in non-TTY environments
ENV CI=true

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/index.js"]
```

## Errors Prevented

- `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` — pnpm 10+ tries to prompt for confirmation when removing or recreating `node_modules`, but no TTY is available in Docker, causing an immediate abort.
- Silent CI pipeline failures where the build exits with a non-zero code and the error message is buried in logs.

## Restrictions

### Hard Boundaries

- Do NOT set `CI=true` globally on developer machines; it changes the behavior of many tools (e.g., `npm install` skips dev dependencies, test runners disable watch mode).
- Do NOT downgrade pnpm to avoid the issue. The `CI=true` approach is the intended solution.

### Soft Boundaries

- Prefer `ENV CI=true` over `RUN CI=true pnpm install` so the variable applies to all subsequent pnpm commands in the same stage.
- If the Dockerfile uses multi-stage builds, add `ENV CI=true` in every stage that runs pnpm commands.

## Self-Check

- [ ] The Dockerfile contains `ENV CI=true` before the first pnpm command.
- [ ] The pnpm version is confirmed to be 10 or later.
- [ ] `docker build` completes the pnpm install step without TTY-related errors.
- [ ] Multi-stage builds have `ENV CI=true` in each relevant stage.

## Examples

### Example 1: Standard Single-Stage Dockerfile

**Before (fails):**

```dockerfile
FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["node", "index.js"]
```

**Error output:**

```
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
The removal of the node_modules directory was aborted because the terminal is not interactive.
```

**After (works):**

```dockerfile
FROM node:20-slim
RUN corepack enable
WORKDIR /app
ENV CI=true
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["node", "index.js"]
```

### Example 2: Multi-Stage Build (Edge Case)

A multi-stage Dockerfile where pnpm runs in both the build stage and the deploy stage. Each stage needs its own `ENV CI=true` because environment variables do not carry across stages.

**Before (fails in second stage):**

```dockerfile
# Stage 1: build
FROM node:20-slim AS builder
RUN corepack enable
WORKDIR /app
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: production
FROM node:20-slim AS production
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Missing ENV CI=true here — will fail
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

**After (works):**

```dockerfile
# Stage 1: build
FROM node:20-slim AS builder
RUN corepack enable
WORKDIR /app
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: production
FROM node:20-slim AS production
RUN corepack enable
WORKDIR /app
ENV CI=true
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

### Example 3: GitHub Actions CI (Edge Case)

The same error can occur in CI pipelines that do not allocate a TTY. Setting the environment variable at the job level covers all steps.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      CI: true   # Already set by default on GitHub Actions, but explicit is safer
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```
