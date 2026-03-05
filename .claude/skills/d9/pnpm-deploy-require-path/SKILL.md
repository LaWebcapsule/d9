---
name: pnpm-deploy-require-path
description: Resolve Cannot find module errors for transitive dependencies in containers built with pnpm deploy.
version: 1.0.0
tags: [pnpm, docker, deploy, node, dependencies]
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
  reproducibility: always
  time_saved: 20m
---

# Cannot Require Transitive Dependencies in pnpm deploy Containers

## Purpose

Resolve `Cannot find module` errors when using `require()` or `node -e` inside Docker containers built with `pnpm deploy --prod`. The `pnpm deploy` command creates a production-only dependency layout where transitive dependencies are stored under `.pnpm/` with hashed directory names and are not hoisted to the top-level `node_modules/`. Standard Node.js module resolution fails for any package that is not a direct dependency of the deployed project.

## Triggers

- Running `node -e "require('knex')"` or similar inside a container built with `pnpm deploy` and getting `Cannot find module 'knex'`.
- Writing a custom entrypoint script that needs to import a package (e.g., `pg`, `knex`, `mysql2`) inside a pnpm-deployed container.
- Debugging a `MODULE_NOT_FOUND` error that only occurs inside the Docker container but works fine in the local development environment.
- Using `node -e` in a Dockerfile `RUN` or entrypoint to execute database setup scripts.

## Behavior

1. **Identify whether the module is a direct or transitive dependency**: Check the `package.json` of the deployed workspace. If the module is listed under `dependencies`, it should be resolvable normally. If it is only a transitive dependency (dependency of a dependency), it will not be hoisted.

2. **Find the full pnpm path**: Inside the container or in the deploy output directory, locate the module:
   ```bash
   find /app/node_modules/.pnpm -path '*/MODULE_NAME/lib/index.js' -o -path '*/MODULE_NAME/index.js' | head -1
   ```
   This returns a path like `/app/node_modules/.pnpm/knex@3.1.0_pg@8.13.1/node_modules/knex/lib/index.js`.

3. **Use the full path in require()**: Strip the trailing entry point file from the found path and use the directory:
   ```javascript
   const knex = require('/app/node_modules/.pnpm/knex@3.1.0_pg@8.13.1/node_modules/knex');
   ```

4. **Alternative -- use a direct dependency instead**: If possible, use a package that IS listed in the workspace's own `dependencies`. For example, use `pg` directly instead of going through `knex` for simple SQL queries:
   ```javascript
   const { Client } = require('pg');
   ```

5. **Alternative -- dynamic path resolution in entrypoint**: If the exact version may change, resolve the path dynamically in the entrypoint script:
   ```bash
   PG_PATH=$(find /app/node_modules/.pnpm -path '*/pg/lib/index.js' | head -1)
   PG_DIR=$(dirname "$PG_PATH")/..
   node -e "const { Client } = require('${PG_DIR}'); /* ... */"
   ```

## Errors Prevented

- `Error: Cannot find module 'knex'` (or any transitive dependency name) at runtime inside pnpm-deployed containers.
- Broken Docker entrypoint scripts that rely on `require()` for database drivers or utilities.
- Failed health checks or boot sequences caused by unresolvable modules in production containers.

## Restrictions

### Hard Boundaries
- Never use `--shamefully-hoist` in production pnpm configurations solely to work around this issue; it defeats the purpose of pnpm's strict dependency isolation and can introduce phantom dependency bugs.
- Never hardcode a pnpm path with a specific version hash without documenting that it must be updated when dependencies change.

### Soft Boundaries
- Prefer using direct dependencies over transitive ones whenever possible; this avoids the path resolution problem entirely.
- When hardcoding a pnpm path is unavoidable, use `find` at runtime to resolve it dynamically so the script survives dependency version bumps.
- Document any full pnpm paths in the Dockerfile or entrypoint with a comment explaining why they are needed.

## Self-Check

- [ ] `node -e "require('MODULE_NAME')"` succeeds inside the running container (using the full path if needed).
- [ ] The entrypoint script does not assume standard `node_modules/MODULE_NAME` layout for transitive dependencies.
- [ ] If a dynamic `find` is used, it includes error handling for the case where the path is not found (e.g., dependency was removed).
- [ ] Hardcoded pnpm paths (if any) are documented with the version they target and flagged for update on dependency changes.

## Examples

### Example 1: Database migration script needs knex in a pnpm deploy container

**Scenario**: A d9 Docker image is built with `pnpm deploy --prod /app`. The entrypoint script runs a database check using `knex`. At container startup:

```
Error: Cannot find module 'knex'
Require stack:
- /app/entrypoint-check.js
```

The same script works in local development because pnpm's workspace hoisting makes `knex` available at the top level.

**Diagnosis**: Inside the container, `ls /app/node_modules/knex` shows "No such file or directory". Running `find /app/node_modules/.pnpm -name 'knex' -type d` reveals the module exists at `/app/node_modules/.pnpm/knex@3.1.0_pg@8.13.1/node_modules/knex`.

**Fix applied**:

Replaced the direct require with a dynamic path resolution in the entrypoint:
```bash
KNEX_PATH=$(find /app/node_modules/.pnpm -path '*/knex/lib/index.js' | head -1)
if [ -z "$KNEX_PATH" ]; then
  echo "ERROR: knex module not found in pnpm store"
  exit 1
fi
KNEX_DIR=$(dirname "$KNEX_PATH")/..
node -e "const knex = require('${KNEX_DIR}'); /* migration logic */"
```

Container starts and the migration script executes successfully.

### Example 2 (Edge Case): Direct dependency works, but its sub-dependency does not

**Scenario**: `pg` is a direct dependency and resolves fine. However, a script also needs `pg-connection-string` (a dependency of `pg`) to parse a connection URI manually:

```javascript
const parse = require('pg-connection-string').parse; // MODULE_NOT_FOUND
```

**Diagnosis**: `pg-connection-string` is a transitive dependency of `pg` and lives inside `.pnpm/pg-connection-string@2.7.0/node_modules/pg-connection-string`.

**Fix applied**:

Instead of requiring `pg-connection-string` directly, the code was refactored to use `pg`'s built-in connection string support, which handles parsing internally:

```javascript
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DB_CONNECTION_STRING });
```

This avoids the transitive dependency entirely. When refactoring is not possible, the `find`-based dynamic resolution from Example 1 applies.

### Example 3 (Edge Case): pnpm version upgrade changes the hash path

**Scenario**: After upgrading pnpm from 8.x to 9.x, the container build succeeds but the entrypoint fails. The hardcoded path `/app/node_modules/.pnpm/pg@8.13.1/node_modules/pg` no longer exists because pnpm 9 changed its content-addressable store layout and the hash in the directory name changed.

**Diagnosis**: `find /app/node_modules/.pnpm -path '*/pg/lib/index.js'` returns a path with a different hash structure than the one hardcoded in the entrypoint.

**Fix applied**:

1. Replaced the hardcoded path with the dynamic `find` approach:
   ```bash
   PG_PATH=$(find /app/node_modules/.pnpm -path '*/pg/lib/index.js' | head -1)
   ```
2. Added a guard clause to fail fast if the path is not found:
   ```bash
   if [ -z "$PG_PATH" ]; then
     echo "FATAL: pg module not found. Check pnpm deploy output."
     exit 1
   fi
   ```
3. The entrypoint now survives pnpm version upgrades and dependency version bumps without manual path updates.
