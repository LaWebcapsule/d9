---
name: pnpm-docker-cache-mount
description: Speed up Docker builds by caching the pnpm store with a BuildKit cache mount, avoiding full re-download on every build.
version: 1.0.0
tags: [pnpm, docker, buildkit, cache, performance]
license: MIT
recommended_scope: universal
metadata:
  author: anonymous-contributor
  source: session-contribution
  session_tokens: 5000
  reproducibility: always
  time_saved: 10m
---

# pnpm-docker-cache-mount

## Purpose

Speed up Docker builds that use pnpm by persisting the pnpm content-addressable store across builds. Without a cache mount, every `RUN pnpm install` re-downloads all dependencies from the registry, even if nothing changed. A BuildKit cache mount keeps the store between builds, reducing install time from minutes to seconds on repeat builds.

## Triggers

- Writing or reviewing a Dockerfile that runs `pnpm install` and build times feel slow.
- Noticing that `docker build` or `docker compose build` re-downloads all npm packages on every run, even when `pnpm-lock.yaml` hasn't changed.
- Optimizing CI/CD pipeline build times for a pnpm-based project.

## Behavior

1. **Confirm BuildKit is available.** BuildKit is the default builder since Docker 23.0. For older versions, set `DOCKER_BUILDKIT=1` or use `docker buildx build`.

2. **Add a cache mount to the `pnpm install` RUN instruction.** The pnpm store default location is `/root/.local/share/pnpm/store` (when running as root in the container):

   ```dockerfile
   RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
       pnpm install --frozen-lockfile
   ```

3. **If running as a non-root user**, find the correct store path with `pnpm store path` and adjust the target accordingly.

4. **Verify the speedup.** Run `docker build` twice. The second run should skip most downloads and complete the install step significantly faster.

### Minimal Fix

```dockerfile
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

### Full Dockerfile Example

```dockerfile
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV CI=true

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/index.js"]
```

## Errors Prevented

- No error per se — this is a performance trap. The symptom is slow Docker builds (~3 minutes for a medium project) that re-download all dependencies every time, even when only application code changed.
- Wasted CI minutes and developer time waiting for builds.

## Restrictions

### Hard Boundaries

- Do NOT use `--mount=type=cache` if your build environment does not support BuildKit (e.g., very old Docker versions or some managed build services). The build will fail with a syntax error on the `RUN` line.
- Do NOT assume the cache mount persists across different CI runners or ephemeral build environments. It is most effective on local development machines and persistent CI runners.

### Soft Boundaries

- Combine with proper layer ordering: `COPY package.json pnpm-lock.yaml` before `COPY .` so Docker's layer cache also helps when only source files change.
- If using multi-stage builds, apply the cache mount in every stage that runs `pnpm install`.

## Self-Check

- [ ] The `RUN pnpm install` instruction uses `--mount=type=cache,target=/root/.local/share/pnpm/store`.
- [ ] BuildKit is enabled (Docker 23.0+ default, or `DOCKER_BUILDKIT=1`).
- [ ] A second `docker build` completes the install step faster than the first.
- [ ] The cache target path matches the actual pnpm store location for the user running in the container.

## Examples

### Example 1: Standard project with slow rebuilds

**Before (slow — re-downloads everything):**

```dockerfile
FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["node", "index.js"]
```

Build time: ~3 minutes (full download every time).

**After (fast — cached store):**

```dockerfile
FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
CMD ["node", "index.js"]
```

Build time: ~15 seconds on repeat builds (packages served from local store).

### Example 2 (Edge Case): Non-root user in container

**Scenario:** The Dockerfile creates a non-root user for security. The pnpm store is at `/home/appuser/.local/share/pnpm/store` instead of `/root/...`.

```dockerfile
FROM node:20-slim
RUN corepack enable

RUN useradd -m appuser
USER appuser
WORKDIR /home/appuser/app

COPY --chown=appuser package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/home/appuser/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY --chown=appuser . .
CMD ["node", "index.js"]
```

### Example 3 (Edge Case): docker compose with BuildKit

**Scenario:** Using `docker compose up --build` but the cache mount doesn't seem to work.

**Diagnosis:** Older versions of Docker Compose v1 (`docker-compose`) don't enable BuildKit by default.

**Fix:** Either export `DOCKER_BUILDKIT=1` or migrate to Compose v2 (`docker compose` as a plugin), which uses BuildKit by default.

```bash
# Option 1: environment variable
DOCKER_BUILDKIT=1 docker-compose build

# Option 2: use Compose v2 (recommended)
docker compose build
```
