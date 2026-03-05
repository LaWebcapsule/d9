---
name: d9-key-secret-env
description: Prevent d9 auth failures by ensuring both KEY and SECRET environment variables are set with distinct values.
version: 1.0.0
tags: [d9, config, auth, environment, deploy]
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
  reproducibility: often
  time_saved: 10m
---

# d9-key-secret-env

## Purpose

Prevent authentication failures in d9 (Directus 9 fork by La Webcapsule) caused by missing or identical `KEY` and `SECRET` environment variables. d9 requires BOTH variables to be set with distinct values. The server starts successfully without them, but auth operations fail silently or with misleading errors, making the root cause hard to diagnose.

## Triggers

- Configuring a new d9 instance (Docker, bare metal, or cloud deployment).
- Debugging auth/login failures where the d9 server starts and responds to requests but tokens are invalid or login returns cryptic errors.
- Reviewing a `docker-compose.yml`, `.env` file, or deployment manifest for a d9 service.
- Migrating from upstream Directus 9 to d9, where prior config may only define `SECRET`.

## Behavior

1. **Check that both `KEY` and `SECRET` are defined.** Look in `docker-compose.yml`, `.env`, Kubernetes manifests, or the hosting platform's environment variable settings.
2. **Verify the values are different.** `KEY` and `SECRET` must not be the same string. They serve different cryptographic purposes.
3. **Generate secure random values if missing.** Use `openssl rand -hex 32` (or equivalent) to produce each value.
4. **Restart the d9 instance** after setting or changing the variables.

### Minimal Fix (.env)

```env
KEY=a1b2c3d4e5f6...   # openssl rand -hex 32
SECRET=f6e5d4c3b2a1... # openssl rand -hex 32 (different value)
```

### Docker Compose Example

```yaml
services:
  d9:
    image: d9:latest
    environment:
      KEY: "${D9_KEY}"
      SECRET: "${D9_SECRET}"
      DB_CLIENT: pg
      DB_HOST: db
      DB_DATABASE: d9
```

### Generation Commands

```bash
# Linux / macOS / Git Bash on Windows
echo "KEY=$(openssl rand -hex 32)"
echo "SECRET=$(openssl rand -hex 32)"

# Node.js alternative
node -e "const c=require('crypto'); console.log('KEY='+c.randomBytes(32).toString('hex')); console.log('SECRET='+c.randomBytes(32).toString('hex'))"
```

## Errors Prevented

- Login returns HTTP 401 or 403 with no actionable error message despite correct credentials.
- Tokens issued by d9 are rejected on subsequent requests (`INVALID_TOKEN`, `TOKEN_EXPIRED` immediately after issuance).
- Refresh token rotation fails silently, logging users out unexpectedly.
- Server starts without errors in logs, giving the false impression that configuration is complete.

## Restrictions

### Hard Boundaries

- Do NOT use the same value for `KEY` and `SECRET`. They are used for different cryptographic operations and reusing values weakens security.
- Do NOT commit `KEY` or `SECRET` values to version control. Use `.env` files (excluded via `.gitignore`), secrets managers, or platform-level environment variable injection.
- Do NOT use short or predictable values (e.g., `KEY=123`, `SECRET=secret`). Always use cryptographically random strings of at least 32 characters.

### Soft Boundaries

- Prefer `openssl rand -hex 32` for generation; it produces 64-character hex strings with 256 bits of entropy.
- In Docker Compose, reference variables from `.env` (e.g., `${D9_KEY}`) rather than hardcoding values in the YAML file.
- When rotating secrets, update both `KEY` and `SECRET` simultaneously to avoid partial invalidation of existing sessions.

## Self-Check

- [ ] Both `KEY` and `SECRET` are defined in the environment configuration.
- [ ] The two values are distinct strings.
- [ ] Values are at least 32 characters long and cryptographically random.
- [ ] Values are not committed to version control.
- [ ] The d9 instance has been restarted after setting or changing the variables.
- [ ] Login and token refresh work correctly after the fix.

## Examples

### Example 1: New Docker Compose Deployment

A developer sets up d9 with Docker Compose and only defines `SECRET` (following upstream Directus documentation).

**Before (auth fails):**

```yaml
services:
  d9:
    image: d9:latest
    environment:
      SECRET: "my-super-secret-value"
      DB_CLIENT: pg
      DB_HOST: db
      DB_PORT: 5432
      DB_DATABASE: d9
      DB_USER: d9
      DB_PASSWORD: d9pass
```

**Symptom:** Server starts. Admin user can be created via bootstrap. Login POST to `/auth/login` returns a token, but subsequent authenticated requests fail with `INVALID_TOKEN`.

**After (works):**

```yaml
services:
  d9:
    image: d9:latest
    environment:
      KEY: "4f8a1c3e7b9d2f0a5c6e8d1b3a7f9e2c4d6a8b0e1f3c5a7d9b2e4f6a8c0d2e"
      SECRET: "9b2e4f6a8c0d2e4f8a1c3e7b9d2f0a5c6e8d1b3a7f9e2c4d6a8b0e1f3c5a7d"
      DB_CLIENT: pg
      DB_HOST: db
      DB_PORT: 5432
      DB_DATABASE: d9
      DB_USER: d9
      DB_PASSWORD: d9pass
```

### Example 2: Bare Metal Deployment with .env (Edge Case)

A developer migrates from upstream Directus 9 to d9. Their existing `.env` has `SECRET` but not `KEY`. The migration completes, d9 starts, but existing user sessions break.

**Before (.env):**

```env
# Carried over from Directus 9
SECRET=original-directus-secret
DB_CLIENT=sqlite3
DB_FILENAME=./data/database.sqlite
```

**Symptom:** d9 starts without errors. Existing sessions from Directus 9 are all invalid (expected after migration). New login attempts succeed intermittently or fail with `"errors":[{"message":"Invalid user credentials."}]` even though credentials are correct.

**Diagnosis:** Run `node -e "console.log(process.env.KEY)"` inside the d9 process context (or check the startup logs in debug mode). `KEY` is `undefined`.

**After (.env):**

```env
KEY=b7c4e9a1f2d8365e0c7a4b1d9f6e3c8a5d2b7f0e4a1c6d9b3f8e5a2c7d0b4f
SECRET=original-directus-secret
DB_CLIENT=sqlite3
DB_FILENAME=./data/database.sqlite
```

### Example 3: Kubernetes Deployment with Secrets (Edge Case)

In a Kubernetes deployment, environment variables come from a Secret resource. A team member creates the secret with only one key, or both keys reference the same secret data field.

**Before (both reference the same value):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: d9-secrets
type: Opaque
data:
  token-secret: NGY4YTFjM2U3YjlkMmYwYTVjNmU4ZDFiM2E3ZjllMmM=
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: d9
          env:
            - name: KEY
              valueFrom:
                secretKeyRef:
                  name: d9-secrets
                  key: token-secret    # Same source as SECRET
            - name: SECRET
              valueFrom:
                secretKeyRef:
                  name: d9-secrets
                  key: token-secret    # Same source as KEY
```

**After (distinct values):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: d9-secrets
type: Opaque
data:
  app-key: NGY4YTFjM2U3YjlkMmYwYTVjNmU4ZDFiM2E3ZjllMmM=
  app-secret: OWIyZTRmNmE4YzBkMmU0Zjh...
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: d9
          env:
            - name: KEY
              valueFrom:
                secretKeyRef:
                  name: d9-secrets
                  key: app-key
            - name: SECRET
              valueFrom:
                secretKeyRef:
                  name: d9-secrets
                  key: app-secret
```
