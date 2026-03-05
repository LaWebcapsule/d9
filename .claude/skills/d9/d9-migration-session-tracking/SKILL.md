---
name: d9-migration-session-tracking
description: Fix silent migration failure where d9 bootstrap registers 20250910A but fails to create session_id columns, causing 500 on login.
version: 1.0.0
tags: [d9, migration, database, postgres, auth]
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
  reproducibility: always
  time_saved: 60m
---

# d9 Bootstrap Silently Fails to Create session_id Columns

## Purpose

Detect and fix a silent migration failure in d9 (Directus 9 fork) where migration `20250910A-add-session-tracking` registers as completed in `directus_migrations` but does not actually create the required `session_id` columns on the `directus_sessions` and `directus_activity` tables. This causes a 500 error on login because the auth system tries to write to a column that does not exist.

## Triggers

- Deploying a fresh d9 instance with PostgreSQL and getting HTTP 500 on the first login attempt.
- Seeing `column "session_id" of relation "directus_sessions" does not exist` in d9 server logs after bootstrap.
- Running `npx directus bootstrap` or the d9 Docker entrypoint on a new or migrated database.
- Upgrading an existing Directus 9 database to d9 where the migration history already contains `20250910A-add-session-tracking`.

## Behavior

1. **Diagnose**: Connect to the PostgreSQL database and verify the columns are missing:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'directus_sessions' AND column_name = 'session_id';
   ```
   If zero rows are returned, the migration failed silently.

2. **Check migration table**: Confirm the migration is registered as applied:
   ```sql
   SELECT * FROM directus_migrations WHERE version = '20250910A';
   ```
   If it exists, d9 will never re-run it.

3. **Fix with idempotent SQL**: Add the missing columns manually. This is safe to run even if the columns already exist:
   ```sql
   ALTER TABLE directus_sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
   ALTER TABLE directus_activity ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
   ```

4. **Automate in Docker entrypoint**: Add the fix to the Docker entrypoint script so it runs before d9 starts. Use the `pg` driver bundled in `node_modules` (via its full pnpm path) to execute the SQL:
   ```bash
   PG_PATH=$(find /app/node_modules/.pnpm -path '*/pg/lib/index.js' | head -1)
   node -e "
     const { Client } = require('${PG_PATH}');
     const c = new Client({ connectionString: process.env.DB_CONNECTION_STRING });
     (async () => {
       await c.connect();
       await c.query('ALTER TABLE directus_sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(64)');
       await c.query('ALTER TABLE directus_activity ADD COLUMN IF NOT EXISTS session_id VARCHAR(64)');
       await c.end();
       console.log('Session tracking columns ensured.');
     })().catch(e => { console.error(e); process.exit(1); });
   "
   ```

5. **Verify**: Restart d9 and confirm login returns 200 with a valid access token.

## Errors Prevented

- HTTP 500 on `POST /auth/login` with `column "session_id" of relation "directus_sessions" does not exist`.
- Complete inability to authenticate any user on a freshly bootstrapped d9 instance.
- Hours of debugging migration internals to understand why a "completed" migration left the schema incomplete.

## Restrictions

### Hard Boundaries
- Never delete the row from `directus_migrations` to force a re-run; this can cause unpredictable behavior if the migration has partial side effects.
- Never modify the migration source file in `node_modules/` or the d9 migration directory after bootstrap, as this will not re-trigger already-applied migrations.
- The `session_id` column type must be `VARCHAR(64)` to match the d9 auth system expectations.

### Soft Boundaries
- Prefer running the fix in the Docker entrypoint rather than manually on the database, so it is repeatable and survives redeployments.
- Use `IF NOT EXISTS` in all ALTER TABLE statements to make the fix idempotent and safe to run on every container start.
- When using `node -e` inside a pnpm-deployed container, use the full `.pnpm/` path for `pg` (see skill `pnpm-deploy-require-path`).

## Self-Check

- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'directus_sessions' AND column_name = 'session_id';` returns exactly one row.
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'directus_activity' AND column_name = 'session_id';` returns exactly one row.
- [ ] `POST /auth/login` with valid credentials returns HTTP 200 and an access token.
- [ ] The Docker entrypoint includes the idempotent fix so fresh deployments are protected automatically.

## Examples

### Example 1: Fresh d9 deployment on ECS with PostgreSQL (RDS)

**Scenario**: A new d9 instance is deployed on AWS ECS. The container runs `npx directus bootstrap` on first start. The bootstrap command completes without errors. An administrator attempts to log in via the d9 admin panel and sees a generic "Unexpected Error" page. The ECS task logs show:

```
POST /auth/login 500
Error: column "session_id" of relation "directus_sessions" does not exist
```

**Diagnosis**: Connected to RDS via `psql`. Ran `\d directus_sessions` and confirmed `session_id` is absent. Checked `directus_migrations` and found `20250910A` is listed as applied.

**Fix applied**:

1. Ran the idempotent ALTER TABLE statements directly on RDS:
   ```sql
   ALTER TABLE directus_sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
   ALTER TABLE directus_activity ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
   ```
2. Added the automated fix to the Docker entrypoint script (before the `npx directus start` line).
3. Restarted the ECS task. Login now works. Subsequent redeployments run the fix harmlessly.

### Example 2 (Edge Case): Migration partially applied after interrupted bootstrap

**Scenario**: During initial deployment, the container was killed by an OOM event mid-bootstrap. On restart, `npx directus bootstrap` sees all migrations (including `20250910A`) as already applied. The `session_id` column exists on `directus_sessions` but is missing from `directus_activity` (the migration was interrupted between the two ALTER TABLE statements).

**Diagnosis**: Login fails with `column "session_id" of relation "directus_activity" does not exist`. Only `directus_activity` is affected.

**Fix applied**:

1. The same idempotent SQL handles this case because `IF NOT EXISTS` skips the column on `directus_sessions` (already present) and creates it on `directus_activity` (missing):
   ```sql
   ALTER TABLE directus_sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
   ALTER TABLE directus_activity ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
   ```
2. No manual intervention needed beyond running the entrypoint fix. The idempotent design makes partial failures a non-issue.

### Example 3 (Edge Case): MySQL database instead of PostgreSQL

**Scenario**: A developer uses MySQL instead of PostgreSQL and encounters a similar 500 on login with a message about missing `session_id`.

**Diagnosis**: Same root cause, but the SQL syntax differs for MySQL.

**Fix applied**:

MySQL does not support `IF NOT EXISTS` on `ALTER TABLE ADD COLUMN`. Use an information_schema check instead:

```sql
SET @dbname = DATABASE();
SELECT COUNT(*) INTO @col_exists
  FROM information_schema.columns
  WHERE table_schema = @dbname AND table_name = 'directus_sessions' AND column_name = 'session_id';
SET @query = IF(@col_exists = 0, 'ALTER TABLE directus_sessions ADD COLUMN session_id VARCHAR(64)', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

Repeat for `directus_activity`. This edge case highlights that the PostgreSQL-specific `IF NOT EXISTS` syntax must be adapted when targeting other database engines.
