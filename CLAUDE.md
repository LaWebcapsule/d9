# d9 — Directus 9 Fork by La Webcapsule

## Project

d9 is an open-source fork of Directus 9 (GPLv3), focused on performance and EU regulatory compliance. Maintained by La Webcapsule.

## Contributing

### The easiest way to contribute: `/skillops`

Every debugging session is a potential contribution. When you solve a non-trivial problem while working on d9, run the **`/skillops`** command to share your experience as a reusable skill.

The pipeline handles everything: it detects the pattern, anonymizes your session data, formats a proper skill file, and opens a PR — all from a single command. Your working branch is never pushed; only the skill files are submitted via a clean branch from `origin/main`.

Each skill tracks the `session_tokens` consumed during the original debugging session. This lets the community quantify how many tokens are saved every time another developer benefits from your contribution instead of debugging the same issue from scratch.

## Skills

### d9 Agent Skills (plugin repo)

Project-specific skills live in a separate repo: **[LaWebcapsule/d9-skills](https://github.com/LaWebcapsule/d9-skills)**

Install them with:
```bash
npx skills add LaWebcapsule/d9-skills
```

These skills follow the [Agent Skills Open Standard](https://agentskills.io/) and work with Claude Code, Cursor, Copilot, and 30+ other agents.

### SkillOps Pipeline (`.claude/skills/skillops/`)
**IMPORTANT — Active monitoring**: After EVERY error resolution and after EVERY multi-step investigation (>3 tool calls), check if the pattern is worth capturing. Do NOT wait for the "perfect" pattern — propose immediately. Read `detect-xp/SKILL.md` for the full trigger system.

Pipeline flow:
1. **detect-xp** — Detect the pattern and propose to contribute (check after EVERY error fix!)
2. **match-existing** — Compare with existing skills (new / amendment / duplicate)
3. **anonymize-session** — Clean & decontextualize sensitive data locally before sharing
4. **format-skill** — Generate SKILL.md in Agent Skills Open Standard format
5. **refine-skill-design** — Audit & improve SKILL.md quality (ASQM >= 17 target)
6. **submit-skill** — Clone d9-skills repo, copy skill files, push + PR (targets `LaWebcapsule/d9-skills`)
7. **discover-skills** — Search external catalogs for existing skills before creating new ones
8. **curate-skills** — Score, tag, and audit skills (runs in CI on PR to d9-skills)

Skills are submitted to `LaWebcapsule/d9-skills`, not to this repo.
Read the full skill SKILL.md files for detailed instructions.

## Important rules

- Code identifiers `@directus/`, `directus_*`, `DIRECTUS_*`, `npx directus`, `new Directus()` must NEVER be renamed
- Plugins must be rebuilt (`pnpm build` in plugins/) before any deployment
- AWS region is eu-west-3 (Paris) for all services
- Contact: support@webcapsule.io
