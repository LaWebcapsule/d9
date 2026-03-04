---
name: d9-fork-setup
description: Complete development environment setup for d9 (Directus 9 fork) — reduces onboarding from 2 days to 2 hours.
tags: [setup, onboarding, directus, development]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 4
  confidence: 0.90
---

# Skill: d9 Fork Setup

## Purpose

Set up a complete d9 development environment from scratch. This skill covers all the pitfalls that typically make Directus fork setup take 2 days for a new developer, reducing it to approximately 2 hours.

## Triggers

- A new developer is setting up d9 for the first time
- Someone has cloned the d9 repository and needs to get it running
- A fresh environment is being set up (new machine, CI, Docker)

## Actions

### Prerequisites

1. Install Node.js v18 or higher (v20 LTS recommended, v24 works but see `node-v24-windows-escape` skill)
2. Install pnpm 10: `npm install -g pnpm@10`
3. Ensure Git is configured

### Setup

4. Clone the repository:
   ```bash
   git clone https://github.com/AurelienMusic/directus9.git
   cd directus9
   ```

5. Install dependencies:
   ```bash
   pnpm install
   ```

6. Configure environment:
   ```bash
   # Copy the env template
   cp api/src/cli/utils/create-env/env-stub.liquid api/.env

   # Edit api/.env with your database credentials
   # Minimum required:
   # DIRECTUS_SECRET=your-random-secret-here
   # DIRECTUS_DB_CLIENT=pg (or mysql, sqlite3)
   # DIRECTUS_DB_CONNECTION_STRING=postgres://user:pass@localhost:5432/d9
   ```

7. Build all packages (REQUIRED before first run):
   ```bash
   pnpm build
   ```

8. Bootstrap the database:
   ```bash
   cd api
   npx directus database install
   npx directus database migrate:latest
   cd ..
   ```

9. Create admin user:
   ```bash
   cd api
   npx directus users create --email admin@example.com --password your-password --role admin
   cd ..
   ```

10. Start development:
    ```bash
    pnpm dev
    ```

## Errors Prevented

- **"Module not found" on first run**: Skipping `pnpm build` (step 7) causes import errors because internal packages haven't been compiled. The error messages point to missing modules that ARE in the repo but need building first. This is the #1 onboarding trap. (2h average debug time)

- **"env-stub.liquid not found"**: Copying the .env file from the wrong location or creating it manually without all required variables. The template at `api/src/cli/utils/create-env/env-stub.liquid` has all variables with documentation. (30min)

- **Wrong pnpm version**: Using pnpm 8 or 9 instead of 10 causes dependency resolution errors. The `pnpm-lock.yaml` format is version-specific. (1h)

- **Database not bootstrapped**: Running `pnpm dev` before `database install` + `migrate:latest` causes API crashes with missing table errors. (30min)

- **Missing DIRECTUS_SECRET**: Starting without a secret in `.env` causes the server to use a default value, which is a security vulnerability. It also causes sessions to invalidate on every restart. (Silent security issue)

## Restrictions

- Do NOT rename `DIRECTUS_*` environment variables to `D9_*` — the engine expects the `DIRECTUS_` prefix (see `preserve-directus-code-identifiers` skill)
- Do NOT skip `pnpm build` even if you only want to work on the app — API packages are dependencies
- On Windows, use Git Bash or WSL for CLI commands — CMD may have path issues with pnpm
- SQLite works for development but is not recommended for production
