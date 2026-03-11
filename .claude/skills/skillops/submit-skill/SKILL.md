---
name: submit-skill
description: Automate skill submission to the d9-skills plugin repo. Clones the external repo, copies skill files, creates a PR.
tags: [pipeline, skillops, meta-skill, git]
version: 3.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: skillops-pipeline
related_skills: [format-skill, refine-skill-design, curate-skills]
---

# Skill: Submit Skill

## Purpose

Automate the "last mile" of the SkillOps pipeline: take validated skill files from the local staging area and create a GitHub Pull Request on the **external `LaWebcapsule/d9-skills` repo**.

**Architecture**: Skills live in a separate plugin repo (`d9-skills`), not in the main d9 codebase. The SkillOps pipeline (detect, format, refine) runs in the main repo, but submission targets the plugin repo. This keeps the main repo clean and follows the Supabase agent-skills pattern.

**Target repo**: `https://github.com/LaWebcapsule/d9-skills`

## Triggers

Activate when ALL of the following are true:
- One or more SKILL.md or AMENDMENT.yaml files exist in `.claude/skills/d9/` that are ready for submission
- The files have been through `format-skill` (Agent Skills standard format) and ideally `refine-skill-design`
- The user has approved the files for submission

Also activate when:
- The user explicitly asks to "submit", "push", or "open a PR" for skills
- `format-skill` finishes (intercept and automate the submission)

## Behavior

### Step 1: Identify skill files to submit

Scan for new/modified skill files in the local staging area:
```bash
# Look for skill files staged locally
ls .claude/skills/d9/*/SKILL.md
```

List them to the user:
```
Ready to submit to LaWebcapsule/d9-skills:
  NEW:       crlf-docker-entrypoint/SKILL.md
  NEW:       pnpm-ci-true-docker/SKILL.md
  AMENDMENT: rebuild-plugins-before-deploy/AMENDMENT.yaml

Submit all as one PR? [All] [Select] [Cancel]
```

### Step 2: Validate before submitting

Run the d9-skills verification script (if available locally) or basic checks:
```bash
# Basic validation: name matches dir, frontmatter has name + description
node scripts/verify-skill-structure.mjs .claude/skills/d9/<skill-dir>
```

If any skill fails validation (score < 10), STOP and hand off to `refine-skill-design`.

### Step 3: Clone the d9-skills repo to a temp directory

```bash
TMPDIR=$(mktemp -d)
gh repo clone LaWebcapsule/d9-skills "$TMPDIR/d9-skills"
cd "$TMPDIR/d9-skills"
```

### Step 4: Create a skill branch and copy files

```bash
git checkout -b skill/<primary-skill-name>

# Copy each skill into the plugin repo structure
# Local:  .claude/skills/d9/<name>/SKILL.md
# Target: skills/<name>/SKILL.md
cp -r /path/to/main-repo/.claude/skills/d9/<name>/ skills/<name>/
```

### Step 5: Commit and push

```bash
git add skills/<name>/
git commit -m "skill: add <name>"
git push -u origin skill/<name>
```

For a single skill: `skill: add crlf-docker-entrypoint`
For multiple: `skill: add crlf-docker-entrypoint, pnpm-ci-true-docker`
For amendments: `skill: amend rebuild-plugins-before-deploy`

### Step 6: Create PR on d9-skills

```bash
gh pr create \
  --repo LaWebcapsule/d9-skills \
  --title "skill: add <name>" \
  --body "<generated body>"
```

PR body structure:
```markdown
## Summary
- <count> new skill(s) / amendment(s) from a d9 debugging session
- <bullet point per skill with 1-line description>

## Token Economy
| Skill | Session Tokens | Est. Tokens Saved per Use |
|-------|---------------|--------------------------|
| <name> | <session_tokens from metadata> | <estimated> |

> Every time a developer avoids this debugging session thanks to this skill,
> the community saves approximately <total est.> tokens.

## Test plan
- [ ] Review each SKILL.md for accuracy
- [ ] Check anonymization (no PII, secrets, project names)
- [ ] Verify SKILL.md follows Agent Skills Open Standard
- [ ] Confirm PR contains ONLY skill files

Generated with [SkillOps Pipeline](https://github.com/LaWebcapsule/directus9)
```

### Step 7: Clean up and confirm

```bash
# Remove the temp clone
rm -rf "$TMPDIR"

# Optionally clean the local staging area
# (keep or remove .claude/skills/d9/<name>/ — user's choice)
```

Show confirmation:
```
PR created successfully!

  URL: https://github.com/LaWebcapsule/d9-skills/pull/<N>
  Target repo: LaWebcapsule/d9-skills
  Branch: skill/<name>
  Skills: <list>
  Session tokens: <total> (recorded in skill metadata)

  Your working branch is unchanged.
  The curate-on-pr CI on d9-skills will run automatically.

  Install: npx skills add LaWebcapsule/d9-skills
```

## Restrictions

### Hard boundaries
- NEVER push without explicit user confirmation
- NEVER force-push or push to main/master directly
- NEVER create a PR if skill validation fails (score < 10)
- NEVER include files from the main d9 repo in the PR — only skill files
- NEVER modify the user's working branch or current repo state
- Target repo is ALWAYS `LaWebcapsule/d9-skills` — hardcoded, not configurable
- Skills MUST follow the Agent Skills Open Standard format (name + description in frontmatter)

### Soft boundaries
- Prefer one PR per session (batch multiple skills together)
- Prefer descriptive branch names: `skill/crlf-docker-entrypoint` over `skill/new`
- If `gh` CLI is not available, show manual instructions
- Clean up the temp directory even if the PR creation fails

## Self-Check

- [ ] All skill files follow Agent Skills Open Standard (name + description in frontmatter)?
- [ ] Frontmatter `name` matches directory name?
- [ ] Used temp clone of d9-skills (not the main repo)?
- [ ] Only skill files in the commit (no main repo files leaked)?
- [ ] session_tokens field present in each skill's metadata?
- [ ] Commit message follows convention (`skill: add/amend <name>`)?
- [ ] PR targets `LaWebcapsule/d9-skills` repo?
- [ ] User confirmed before push?
- [ ] Temp directory cleaned up?
- [ ] PR URL shown to user?

## Examples

### Example 1: Single new skill

```
Ready to submit to LaWebcapsule/d9-skills:
  NEW: crlf-docker-entrypoint/SKILL.md (score: 19/20)
  Session tokens: ~45,000

  Will clone LaWebcapsule/d9-skills to temp, create branch skill/crlf-docker-entrypoint,
  copy skills/crlf-docker-entrypoint/SKILL.md, commit, push, and open PR.

  Your working branch and main repo are NOT affected.

  Proceed? [Yes] [Edit first] [Cancel]
```

User says Yes:
  1. Clone d9-skills to /tmp
  2. Create branch skill/crlf-docker-entrypoint
  3. Copy SKILL.md into skills/crlf-docker-entrypoint/
  4. Commit + push + gh pr create --repo LaWebcapsule/d9-skills
  5. Clean up temp
  6. Show PR URL

### Example 2: gh CLI not available

```
gh CLI not found. Manual steps:

  1. Clone: git clone https://github.com/LaWebcapsule/d9-skills.git /tmp/d9-skills
  2. Branch: cd /tmp/d9-skills && git checkout -b skill/crlf-docker-entrypoint
  3. Copy: cp -r <path>/.claude/skills/d9/crlf-docker-entrypoint/ skills/crlf-docker-entrypoint/
  4. Commit: git add skills/ && git commit -m "skill: add crlf-docker-entrypoint"
  5. Push: git push -u origin skill/crlf-docker-entrypoint
  6. Open PR: https://github.com/LaWebcapsule/d9-skills/compare/skill/crlf-docker-entrypoint
```
