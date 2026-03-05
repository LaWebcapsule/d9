# d9 — Directus 9 Fork by La Webcapsule

## Project

d9 is an open-source fork of Directus 9 (GPLv3), focused on performance and EU regulatory compliance. Maintained by La Webcapsule.

## Skills

This project includes AI agent skills in `.claude/skills/`:

### d9 Experience Skills (`.claude/skills/d9/`)
Project-specific skills derived from real debugging sessions. Read these before working on the relevant areas:
- **rebuild-plugins-before-deploy** — Always rebuild plugins before deploy (silent failure trap)
- **preserve-directus-code-identifiers** — Never rename `@directus/`, `directus_*`, `DIRECTUS_*` in code
- **node-v24-windows-escape** — Escape `!` in `node -e` on Windows
- **vitepress-logo-sizing** — Fix logo distortion in VitePress dark mode
- **cdn-to-local-assets-migration** — Process for migrating CDN assets to local
- **ses-eu-west3-setup** — AWS SES must use eu-west-3 for EU projects
- **d9-fork-setup** — Complete dev environment setup guide

### SkillOps Pipeline (`.claude/skills/skillops/`)
**IMPORTANT — Active monitoring**: After EVERY error resolution and after EVERY multi-step investigation (>3 tool calls), check if the pattern is worth capturing. Do NOT wait for the "perfect" pattern — propose immediately. Read `detect-xp/SKILL.md` for the full trigger system.

Pipeline flow:
1. **detect-xp** — Detect the pattern and propose to contribute (check after EVERY error fix!)
2. **match-existing** — Compare with existing skills (new / amendment / duplicate)
3. **anonymize-session** — Clean & decontextualize sensitive data locally before sharing
4. **format-skill** — Generate SKILL.md or AMENDMENT.yaml
5. **refine-skill-design** — Audit & improve SKILL.md quality (ASQM >= 17 target)
6. **submit-skill** — Git branch + commit + push + PR creation (automates the last mile)
7. **discover-skills** — Search external catalogs for existing skills before creating new ones
8. **curate-skills** — Score, tag, and audit skills (runs in CI on PR)

Verification: `node scripts/verify-skill-structure.mjs --all` and `node scripts/verify-registry.mjs`

Read the full skill SKILL.md files for detailed instructions.

## Important rules

- Code identifiers `@directus/`, `directus_*`, `DIRECTUS_*`, `npx directus`, `new Directus()` must NEVER be renamed
- Plugins must be rebuilt (`pnpm build` in plugins/) before any deployment
- AWS region is eu-west-3 (Paris) for all services
- Contact: support@webcapsule.io
