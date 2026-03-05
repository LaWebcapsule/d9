#!/bin/sh
set -e

# Bootstrap d9 (create tables, run migrations, create admin user)
node /directus/cli.js bootstrap

# Post-bootstrap fixes for PostgreSQL
if [ "$DB_CLIENT" = "pg" ]; then
  PG_MOD=$(find /directus/node_modules/.pnpm -path '*/pg/lib/index.js' | head -1)
  if [ -n "$PG_MOD" ]; then
    PG_DIR=$(dirname "$PG_MOD")/..
    node -e "
      const { Client } = require('$PG_DIR');
      const c = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
      (async () => {
        await c.connect();
        // Fix: migration 20250910A registers but doesn't create session_id columns
        await c.query('ALTER TABLE directus_sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(64)');
        await c.query('ALTER TABLE directus_activity ADD COLUMN IF NOT EXISTS session_id VARCHAR(64)');
        // Ensure d9 branding (fixes column default inherited from upstream Directus)
        const r = await c.query('SELECT id FROM directus_settings LIMIT 1');
        if (r.rowCount === 0) {
          await c.query(\"INSERT INTO directus_settings (project_name, project_descriptor) VALUES ('d9', 'd9 Application')\");
          console.log('Initialized d9 branding defaults');
        }
        await c.end();
      })().catch(e => { console.error(e); process.exit(1); });
    "
  fi
fi

# Start d9
exec node /directus/cli.js start
