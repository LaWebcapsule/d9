---
name: submit-skill
description: Automate git branch, commit, push, and PR creation for validated skill files. Orchestrates existing tooling (PR template, ASCII comment generator, CI).
tags: [pipeline, skillops, meta-skill, git]
version: 2.1.0
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

The skill files are typically NEW (untracked) files that `git stash` cannot handle.
Instead, use a filesystem copy to a temp directory, switch branches cleanly, then copy back.

```bash
# 1. Save the current branch name to return later
WORK_BRANCH=$(git branch --show-current)

# 2. Copy skill files to a temp directory (works for both tracked and untracked files)
#    macOS/Linux:
TMPDIR=$(mktemp -d)
#    Windows (PowerShell):
#    $TMPDIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; mkdir $_ }

cp -r .claude/skills/<dirs>/ "$TMPDIR/skill-files/"
cp .skills.json "$TMPDIR/" 2>/dev/null || true
cp .claude/skills/INDEX.md "$TMPDIR/" 2>/dev/null || true

# 3. Clean the working tree of these new files so git checkout doesn't complain
rm -rf .claude/skills/<dirs>/  # only the NEW skill dir(s), not all skills

# 4. Fetch latest origin and create clean branch
git fetch origin
git checkout -b skill/<primary-skill-name> origin/main

# 5. Restore skill files from temp into the clean branch
mkdir -p .claude/skills/d9/<name>/
cp -r "$TMPDIR/skill-files/"* .claude/skills/d9/<name>/
cp "$TMPDIR/.skills.json" . 2>/dev/null || true
mkdir -p .claude/skills/
cp "$TMPDIR/INDEX.md" .claude/skills/ 2>/dev/null || true

# 6. Also bring verification scripts from working branch if not on main
git checkout "$WORK_BRANCH" -- scripts/verify-skill-structure.mjs 2>/dev/null || true
git checkout "$WORK_BRANCH" -- scripts/verify-registry.mjs 2>/dev/null || true
git checkout "$WORK_BRANCH" -- scripts/generate-skill-pr-comment.js 2>/dev/null || true
git checkout "$WORK_BRANCH" -- schemas/skill-metadata.json 2>/dev/null || true

# 7. Stage and commit
git add .claude/skills/<dirs>/ .skills.json .claude/skills/INDEX.md scripts/ schemas/
git commit -m "skill: add <name> [+ <name2>, ...]"

# 8. Clean up temp
rm -rf "$TMPDIR"
```

**Windows note**: Replace `mktemp -d` with `$env:TEMP + random dir`, `cp -r` with `Copy-Item -Recurse`,
and `rm -rf` with `Remove-Item -Recurse -Force`. The logic is identical.

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
```

The user's working branch is unchanged — the new skill files were removed in Step 4.3
before switching branches. If the user wants them back on the working branch, they can
cherry-pick or re-run the format step.

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
- [ ] Used temp directory copy (not git stash) to handle untracked skill files?
- [ ] Only skill-related files in the commit (no working branch files leaked)?
- [ ] session_tokens field present in each skill's frontmatter?
- [ ] Token Economy section in PR body?
- [ ] Commit message follows convention (`skill: add/amend <name>`)?
- [ ] PR body includes ASCII review from generate-skill-pr-comment.js?
- [ ] User confirmed before push?
- [ ] Returned to working branch after PR creation?
- [ ] Temp directory cleaned up?
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
  1. Copy skill files to /tmp (or %TEMP% on Windows)
  2. Remove new skill files from working tree
  3. Create clean branch from origin/main
  4. Restore skill files from temp
  5. Commit + push + gh pr create
  6. Return to feature/my-work
  7. Clean up temp
  8. Show PR URL

### Example 2: gh CLI not available

```
gh CLI not found. Manual steps:

  git push -u origin skill/crlf-docker-entrypoint

  Then open: https://github.com/LaWebcapsule/directus9/compare/skill/crlf-docker-entrypoint
  Use the "skill-contribution" PR template.

  PR body (copy-paste):
  <generated body>
```
