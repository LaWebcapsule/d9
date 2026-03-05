---
name: submit-skill
description: Automate git branch, commit, push, and PR creation for validated skill files. Orchestrates existing tooling (PR template, ASCII comment generator, CI).
tags: [pipeline, skillops, meta-skill, git]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: skillops-pipeline
related_skills: [format-skill, refine-skill-design, curate-skills]
input_schema:
  type: free-form
  description: One or more skill directories ready for submission (after format-skill + refine-skill-design)
output_schema:
  type: free-form
  description: PR URL and submission summary
---

# Skill: Submit Skill

## Purpose

Automate the "last mile" of the SkillOps pipeline: take validated skill files from disk and create a GitHub Pull Request. This skill orchestrates existing infrastructure (PR template, ASCII comment generator, CI workflow) — it does NOT duplicate their logic.

## Triggers

Activate when ALL of the following are true:
- One or more SKILL.md or AMENDMENT.yaml files exist in `.claude/skills/` that are not yet committed
- The files have been through `format-skill` (correct structure) and ideally `refine-skill-design` (quality check)
- The user has approved the files for submission

Also activate when:
- The user explicitly asks to "submit", "push", or "open a PR" for skills
- `format-skill` finishes and shows the manual PR instructions (intercept and automate instead)

## Behavior

### Step 1: Identify skill files to submit

Scan for uncommitted skill files:
```bash
git status --short .claude/skills/
```

List them to the user:
```
Ready to submit:
  NEW:       .claude/skills/d9/crlf-docker-entrypoint/SKILL.md
  NEW:       .claude/skills/d9/pnpm-ci-true-docker/SKILL.md
  AMENDMENT: .claude/skills/d9/rebuild-plugins-before-deploy/AMENDMENT.yaml

Submit all as one PR, or select specific skills?
[All] [Select] [Cancel]
```

### Step 2: Validate before submitting

Run the existing verification script:
```bash
node scripts/verify-skill-structure.mjs <skill-dir>
```

If any skill fails validation (score < 10), STOP and hand off to `refine-skill-design`.

### Step 3: Update registry

Add new skills to `.skills.json` and `.claude/skills/INDEX.md` if not already listed.

### Step 4: Create branch and commit

```bash
# Branch name from skill names
git checkout -b skill/<primary-skill-name>

# Stage skill files + registry updates
git add .claude/skills/<dirs>/ .skills.json .claude/skills/INDEX.md

# Commit with standardized message
git commit -m "skill: add <name> [+ <name2>, ...]"
```

For a single skill: `skill: add crlf-docker-entrypoint`
For multiple: `skill: add crlf-docker-entrypoint, pnpm-ci-true-docker`
For amendments: `skill: amend rebuild-plugins-before-deploy (v1.0.0 → v1.0.1)`

### Step 5: Generate PR body

Use the existing tools:
```bash
# Generate ASCII review for each skill
node scripts/generate-skill-pr-comment.js .claude/skills/d9/<name>
```

Combine into a PR body using this structure:
```markdown
## Summary
- <count> new skill(s) / amendment(s) from <context> session
- <bullet point per skill with 1-line description>

## Skill Reviews

<ASCII output from generate-skill-pr-comment.js for each skill>

## Verification
- verify-skill-structure: <PASS/FAIL with scores>
- verify-registry: <PASS/FAIL>

## Test plan
- [ ] Review each SKILL.md for accuracy
- [ ] Check anonymization (no PII, secrets, project names)
- [ ] Verify CI curate-on-pr action runs successfully

🤖 Generated with [SkillOps Pipeline](https://github.com/AurelienMusic/directus9)
```

### Step 6: Push and create PR

```bash
git push -u origin skill/<name>

gh pr create \
  --title "skill: add <name>" \
  --body "<generated body>" \
  --template skill-contribution.md
```

### Step 7: Confirm to user

```
✅ PR created successfully!

  URL: https://github.com/AurelienMusic/directus9/pull/<N>
  Branch: skill/<name>
  Skills: <list>

  The curate-on-pr CI will run automatically and post ASQM scores.
  A maintainer will review and merge.
```

## Restrictions

### Hard boundaries
- NEVER push without explicit user confirmation — show the full commit diff first
- NEVER force-push or push to main/master directly
- NEVER create a PR if verify-skill-structure fails (score < 10)
- NEVER include files outside `.claude/skills/`, `.skills.json`, and `.claude/skills/INDEX.md` in the commit
- NEVER skip the branch step — always work on a dedicated `skill/` branch

### Soft boundaries
- Prefer one PR per session (batch multiple skills together)
- Prefer descriptive branch names: `skill/crlf-docker-entrypoint` over `skill/new-skills`
- If `gh` CLI is not available, show manual instructions instead of failing

## Self-Check

- [ ] All skill files pass verify-skill-structure (score >= 10)?
- [ ] Registry (.skills.json, INDEX.md) updated?
- [ ] Working on a dedicated skill/ branch (not main)?
- [ ] Commit message follows convention (`skill: add/amend <name>`)?
- [ ] PR body includes ASCII review from generate-skill-pr-comment.js?
- [ ] User confirmed before push?
- [ ] PR URL shown to user at the end?

## Examples

### Example 1: Single new skill

```
Ready to submit:
  NEW: .claude/skills/d9/crlf-docker-entrypoint/SKILL.md (score: 18/20)

  Branch: skill/crlf-docker-entrypoint
  Commit: skill: add crlf-docker-entrypoint

  Push and create PR? [Yes] [Edit first] [Cancel]
```

→ User says Yes → push + `gh pr create` → show PR URL.

### Example 2: Batch from a session

```
Ready to submit (5 skills from Docker setup session):
  NEW: crlf-docker-entrypoint (18/20)
  NEW: d9-key-secret-env (17/20)
  NEW: d9-migration-session-tracking (19/20)
  NEW: pnpm-ci-true-docker (17/20)
  NEW: pnpm-deploy-require-path (18/20)

  Branch: skill/docker-setup-batch
  Commit: skill: add crlf-docker-entrypoint, d9-key-secret-env, d9-migration-session-tracking, pnpm-ci-true-docker, pnpm-deploy-require-path

  Push and create PR? [Yes] [Edit first] [Cancel]
```

### Example 3 (edge case): gh CLI not available

```
⚠️ gh CLI not found. Manual steps:

  git push -u origin skill/crlf-docker-entrypoint

  Then open: https://github.com/AurelienMusic/directus9/compare/skill/crlf-docker-entrypoint
  Use the "skill-contribution" PR template.

  PR body (copy-paste):
  <generated body>
```
