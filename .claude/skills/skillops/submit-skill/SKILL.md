---
name: submit-skill
description: Automate git branch, commit, push, and PR creation for validated skill files. Orchestrates existing tooling (PR template, ASCII comment generator, CI).
tags: [pipeline, skillops, meta-skill, git]
version: 2.0.0
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

**CRITICAL SAFETY**: This skill creates a CLEAN branch from `origin/main` to ensure that ONLY skill files are pushed. The user's working branch is never pushed, protecting private work, configs, and secrets from leaking into the public repository.

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

### Step 3: Update registry (on the working branch, locally)

Add new skills to `.skills.json` and `.claude/skills/INDEX.md` if not already listed.
Do NOT commit these changes yet — they stay as local modifications on the working branch.

### Step 4: Create a CLEAN branch from origin and copy ONLY skill files

**CRITICAL**: Never branch from the current working branch. The working branch may contain
unfinished work, private configs, secrets, or project-specific modifications that MUST NOT
be pushed to the public repository.

Instead, create a fresh branch from `origin/main` and surgically copy only the skill files:

```bash
# 1. Save the current branch name to return later
WORK_BRANCH=$(git branch --show-current)

# 2. Stash any uncommitted changes on the working branch
git stash push -m "skillops-submit-temp"

# 3. Fetch latest origin
git fetch origin

# 4. Create a clean branch from origin/main
git checkout -b skill/<primary-skill-name> origin/main

# 5. Copy ONLY the skill files from the working branch
#    Use git checkout <branch> -- <paths> to selectively bring files
git checkout "$WORK_BRANCH" -- .claude/skills/<dirs>/
git checkout "$WORK_BRANCH" -- .skills.json
git checkout "$WORK_BRANCH" -- .claude/skills/INDEX.md

# 6. Also copy verification scripts if they exist on working branch but not on main
git checkout "$WORK_BRANCH" -- scripts/verify-skill-structure.mjs 2>/dev/null || true
git checkout "$WORK_BRANCH" -- scripts/verify-registry.mjs 2>/dev/null || true
git checkout "$WORK_BRANCH" -- scripts/generate-skill-pr-comment.js 2>/dev/null || true
git checkout "$WORK_BRANCH" -- schemas/skill-metadata.json 2>/dev/null || true

# 7. Commit with standardized message
git commit -m "skill: add <name> [+ <name2>, ...]"
```

For a single skill: `skill: add crlf-docker-entrypoint`
For multiple: `skill: add crlf-docker-entrypoint, pnpm-ci-true-docker`
For amendments: `skill: amend rebuild-plugins-before-deploy (v1.0.0 -> v1.0.1)`

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

## Token Economy
| Skill | Session Tokens | Est. Tokens Saved per Use |
|-------|---------------|--------------------------|
| <name> | <session_tokens from frontmatter> | <time_saved x ~500 tokens/min> |
| **Total** | **<sum>** | **<sum>** |

> Every time a developer avoids this debugging session thanks to this skill,
> the community saves approximately <total est.> tokens.

## Skill Reviews

<ASCII output from generate-skill-pr-comment.js for each skill>

## Verification
- verify-skill-structure: <PASS/FAIL with scores>
- verify-registry: <PASS/FAIL>

## Test plan
- [ ] Review each SKILL.md for accuracy
- [ ] Check anonymization (no PII, secrets, project names)
- [ ] Verify CI curate-on-pr action runs successfully
- [ ] Confirm PR contains ONLY skill files (no working branch leaks)

Generated with [SkillOps Pipeline](https://github.com/LaWebcapsule/directus9)
```

### Step 6: Push and create PR

```bash
git push -u origin skill/<name>

gh pr create \
  --title "skill: add <name>" \
  --body "<generated body>"
```

### Step 7: Return to working branch

After pushing the clean skill branch, switch back to the user's working branch:

```bash
# Return to the working branch
git checkout "$WORK_BRANCH"

# Restore any stashed changes
git stash pop 2>/dev/null || true
```

The skill files and registry updates remain as local modifications on the working branch
(from Step 3). This is expected — the user's branch evolves independently of the PR.

### Step 8: Confirm to user

```
PR created successfully!

  URL: https://github.com/LaWebcapsule/directus9/pull/<N>
  Branch: skill/<name> (clean, from origin/main — only skill files)
  Skills: <list>
  Session tokens: <total> (recorded in skill frontmatter)

  You are back on: <working-branch>
  Your working branch was NOT pushed — only the skill files were submitted.
  The curate-on-pr CI will run automatically and post ASQM scores.
```

## Restrictions

### Hard boundaries
- NEVER push without explicit user confirmation — show the full commit diff first
- NEVER force-push or push to main/master directly
- NEVER create a PR if verify-skill-structure fails (score < 10)
- NEVER include files outside `.claude/skills/`, `.skills.json`, `.claude/skills/INDEX.md`, `scripts/`, and `schemas/` in the commit
- NEVER branch from the current working branch — always create a clean branch from `origin/main`
- NEVER skip the return to the working branch after push (Step 7)
- NEVER leave the user on the skill/ branch after the PR is created

### Soft boundaries
- Prefer one PR per session (batch multiple skills together)
- Prefer descriptive branch names: `skill/crlf-docker-entrypoint` over `skill/new-skills`
- If `gh` CLI is not available, show manual instructions instead of failing

## Self-Check

- [ ] All skill files pass verify-skill-structure (score >= 10)?
- [ ] Registry (.skills.json, INDEX.md) updated?
- [ ] Clean branch created from origin/main (NOT from working branch)?
- [ ] Only skill-related files in the commit (no working branch files leaked)?
- [ ] session_tokens field present in each skill's frontmatter?
- [ ] Token Economy section in PR body?
- [ ] Commit message follows convention (`skill: add/amend <name>`)?
- [ ] PR body includes ASCII review from generate-skill-pr-comment.js?
- [ ] User confirmed before push?
- [ ] Returned to working branch after PR creation?
- [ ] Stashed changes restored?
- [ ] PR URL shown to user at the end?

## Examples

### Example 1: Single new skill (clean branch flow)

```
Ready to submit:
  NEW: .claude/skills/d9/crlf-docker-entrypoint/SKILL.md (score: 18/20)
  Session tokens: ~45,000

  Will create: skill/crlf-docker-entrypoint (from origin/main)
  Only these files will be in the PR:
    .claude/skills/d9/crlf-docker-entrypoint/SKILL.md
    .skills.json
    .claude/skills/INDEX.md

  Your working branch (feature/my-work) will NOT be pushed.

  Push and create PR? [Yes] [Edit first] [Cancel]
```

User says Yes:
  1. Stash working changes
  2. Create clean branch from origin/main
  3. Copy skill files only
  4. Push + gh pr create
  5. Return to feature/my-work
  6. Restore stash
  7. Show PR URL

### Example 2: gh CLI not available

```
gh CLI not found. Manual steps:

  git push -u origin skill/crlf-docker-entrypoint

  Then open: https://github.com/LaWebcapsule/directus9/compare/skill/crlf-docker-entrypoint
  Use the "skill-contribution" PR template.

  PR body (copy-paste):
  <generated body>
```
