---
name: preserve-directus-code-identifiers
description: When rebranding a Directus fork, never rename code identifiers — only rename prose text.
tags: [fork, rebrand, directus, migration]
version: 1.1.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 8
  confidence: 0.97
  contributors: 3
---

# Skill: Preserve Directus Code Identifiers

## Purpose

When rebranding a Directus fork (e.g., Directus → d9), you must distinguish between **prose text** (which should be renamed) and **code identifiers** (which must NEVER be renamed). Code identifiers are tied to npm packages, database schemas, and environment variable parsing that will break if renamed.

## Triggers

- A mass rename/replace of "directus" to another name is being performed
- A rebrand script (sed, replace-all, or similar) is being run
- Files with `.md`, `.ts`, `.js`, or `.vue` extensions are being modified with string replacement

## Actions

1. **SPLIT** the rename operation into two categories:

   **OK to rename (prose):**
   - Documentation text, comments, UI labels
   - README content, page titles, descriptions
   - Marketing copy, feature descriptions

   **NEVER rename (code identifiers):**
   - `@directus/` — npm package scope (imports, package.json dependencies)
   - `directus_` — database table prefix (`directus_users`, `directus_roles`, etc.)
   - `DIRECTUS_` — environment variables (`DIRECTUS_SECRET`, `DIRECTUS_DB_*`, etc.)
   - `npx directus` — CLI invocations
   - `new Directus()` — SDK constructor calls
   - `createDirectus()` — SDK factory function
   - `directus/` in import paths

2. If using a script: add exclusion patterns for code blocks, import statements, and env var references
3. After any mass rename: grep for the protected patterns to verify none were accidentally changed
4. Run the test suite to catch broken imports early

## Errors Prevented

- **Broken npm imports**: `@d9/sdk` does not exist on npm — the package is `@directus/sdk`. Renaming the import scope causes build failures. (30min debug)
- **Database tables not found**: `d9_users` doesn't exist — the schema uses `directus_users`. Renaming table prefixes causes API 500 errors on every data request. (1h debug)
- **Environment variables ignored**: `D9_SECRET` is not read by the Directus engine — it expects `DIRECTUS_SECRET`. The app starts with default (insecure) values silently. (2h debug, security risk)
- **SDK constructor fails**: `new D9()` is not a valid constructor. The SDK exports `Directus` or `createDirectus`. (30min debug)

3 contributors made these mistakes independently during the d9 rebrand. Each occurrence cost 30min to 2h of debugging.

## Restrictions

- Do NOT create aliases or re-exports (e.g., `export { Directus as D9 }`) — this adds maintenance burden for no benefit
- Do NOT rename database tables — this requires a migration and breaks existing data
- Do NOT rename environment variables — this breaks every existing deployment's `.env` file
- The `@directus/` npm scope is owned by Directus Inc. — you cannot publish packages there anyway
