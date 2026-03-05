---
name: crlf-docker-entrypoint
description: Prevent shell script failures in Docker containers caused by Windows CRLF line endings.
version: 1.0.0
tags: [docker, windows, platform, shell]
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
  reproducibility: always
  time_saved: 15m
---

# CRLF Line Endings Break Shell Scripts in Docker Containers

## Purpose

Prevent `/bin/sh` execution failures caused by Windows CRLF (`\r\n`) line endings in shell scripts that are copied into Linux-based Docker containers (Alpine, Debian, etc.). The `\r` character is interpreted as part of the command or flag, producing cryptic errors like `illegal option -` on `set -e`.

## Triggers

- Creating or editing any `.sh` file on a Windows machine that will be `COPY`'d or `ADD`'d into a Docker image.
- Modifying a `Dockerfile` that copies shell scripts from a Windows host into a Linux container.
- Debugging a Docker build or container startup that fails with `illegal option`, `not found`, or `\r` related errors from `/bin/sh`.

## Behavior

1. **Detect**: Check if the `.sh` file has CRLF endings. Run `file <script>.sh` (shows "CRLF" if present) or `od -c <script>.sh | head` (look for `\r\n`).
2. **Fix at source (preferred)**: Configure `.gitattributes` in the repository root to force LF on shell scripts:
   ```
   *.sh text eol=lf
   ```
   Then re-checkout the file: `git checkout -- <script>.sh`.
3. **Fix in Dockerfile (fallback)**: Add a `RUN` instruction immediately after the `COPY`:
   ```dockerfile
   COPY entrypoint.sh /app/entrypoint.sh
   RUN sed -i 's/\r$//' /app/entrypoint.sh
   ```
4. **Fix locally before build**: Run `sed -i 's/\r$//' <script>.sh` on the host before `docker build`.

Always prefer the `.gitattributes` approach because it prevents the problem at the root for all contributors.

## Errors Prevented

- `/bin/sh: illegal option -` when the container runs `set -e` from an entrypoint script.
- `exec format error` or `not found` on scripts with a shebang line containing a trailing `\r`.
- Silent failures in multi-line shell commands where `\r` corrupts variable values or command arguments.

## Restrictions

### Hard Boundaries
- Never disable `set -e` as a workaround for the CRLF issue; the real fix is correcting line endings.
- Never convert binary files with `sed`; only target `.sh` and other text-based scripts.

### Soft Boundaries
- Prefer `.gitattributes` over Dockerfile `sed` to keep the fix version-controlled and automatic.
- Avoid relying on editor-level settings alone (e.g., VS Code `files.eol`), as they do not protect against other tools or contributors.

## Self-Check

- [ ] The `.sh` file reports `ASCII text` (not `ASCII text, with CRLF line terminators`) when inspected with `file`.
- [ ] The Docker container starts without `/bin/sh` errors related to line endings.
- [ ] A `.gitattributes` entry exists for `*.sh` with `text eol=lf`.
- [ ] After cloning on a fresh Windows machine, the `.sh` files still have LF endings.

## Examples

### Example 1: Entrypoint fails on Alpine container

**Scenario**: A `docker-entrypoint.sh` is created on Windows with VS Code (default CRLF). The Dockerfile copies it in and sets it as `ENTRYPOINT`. On `docker run`, the container exits immediately with:

```
/bin/sh: illegal option -
```

**Diagnosis**: `docker run --rm --entrypoint cat myimage /app/docker-entrypoint.sh | od -c | head` reveals `\r\n` sequences.

**Fix applied**:

1. Added to `.gitattributes`:
   ```
   *.sh text eol=lf
   ```
2. Re-normalized the file:
   ```bash
   git add --renormalize docker-entrypoint.sh
   git commit -m "fix: force LF endings on shell scripts"
   ```
3. Rebuilt the image. Container starts cleanly.

### Example 2 (Edge Case): Script works locally but fails in CI

**Scenario**: A developer runs `docker build` on macOS (which uses LF natively) and everything works. CI runs on a Windows runner with Git configured as `core.autocrlf=true`. The checkout converts `.sh` files to CRLF. The Docker build succeeds (no syntax check at build time), but the container crashes at runtime.

**Diagnosis**: The CI log shows the container exiting with code 2. Adding `RUN cat -A /app/entrypoint.sh` to the Dockerfile reveals lines ending with `^M$` instead of just `$`.

**Fix applied**:

1. Added `.gitattributes` with `*.sh text eol=lf` (this overrides `core.autocrlf` for matching files).
2. Added a defensive `RUN sed -i 's/\r$//' /app/entrypoint.sh` in the Dockerfile as a belt-and-suspenders measure for environments where `.gitattributes` might be bypassed.
3. CI pipeline now passes on both Windows and Linux runners.
