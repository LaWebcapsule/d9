---
name: rebuild-plugins-before-deploy
description: Always rebuild Directus plugins before deployment to avoid silent extension failures in production.
tags: [deploy, plugins, directus]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 3
  confidence: 0.82
---

# Skill: Rebuild Plugins Before Deploy

## Purpose

Directus plugins must be rebuilt from source (`plugins/`) before every deployment. If you deploy without rebuilding, the extensions directory will contain stale or missing builds, and **the server will start normally but custom endpoints, hooks, and interfaces will silently not work**. There is no error message — the server looks healthy but custom functionality is missing.

## Triggers

- A deploy command is about to be executed (`npm run deploy`, `directus deploy`, Docker build)
- Files in `plugins/` have been modified since last build
- The `extensions/` directory exists in the project

## Actions

1. Before any deployment, check if files in `plugins/` have changed since the last build
2. If yes, run `npm run build` (or `pnpm build`) in each plugin directory under `plugins/`
3. Verify the build output exists in each plugin's `dist/` folder
4. Copy build output to `extensions/` (or verify the build outputs directly there)
5. Continue with the deployment

## Errors Prevented

- **"Extensions not found" — silent failure in production**
  The server starts successfully, returns 200 on healthcheck, logs show normal startup. But custom API endpoints return 404, custom hooks don't fire, custom interfaces don't render. There is NO error in the logs. Diagnosed after 2h of debugging on 3 independent sessions. The root cause each time: plugins were modified but not rebuilt before deploy.

## Restrictions

- Do not skip the rebuild even if "nothing changed" — dependency updates in the monorepo can affect plugin builds
- Do not assume `extensions/` is auto-generated — it must be explicitly populated from plugin builds
- Check build output exists before deploying — a failed build is better caught here than in production
