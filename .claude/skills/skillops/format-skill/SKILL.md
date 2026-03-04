---
name: format-skill
description: Generate a SKILL.md (new skill) or AMENDMENT.yaml (amendment) from an anonymized experience, ready for PR submission.
tags: [pipeline, skillops, meta-skill]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: skillops-pipeline
related_skills: [detect-xp, match-existing, anonymize-session, curate-skills]
---

# Skill: Format Skill

## Purpose

Transform an anonymized experience into a properly formatted, PR-ready skill file. Generates either a complete SKILL.md (for new skills) or an AMENDMENT.yaml (for amendments to existing skills).

This is the final local step before the developer submits a PR.

## Triggers

- Called by anonymize-session after the developer approves the anonymized content
- Input: anonymized experience + verdict (new/amendment) + target skill info

## Behavior

### Case 1: New Skill

Generate a complete SKILL.md:

```yaml
---
name: [auto-generated-kebab-case]
description: [one-line description from the experience]
tags: [auto-detected from context]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
---

# Skill: [Human Readable Name]

## Purpose
[Why this skill matters — what problem it prevents]

## Triggers
[When this skill should activate — specific conditions]
- [trigger 1]
- [trigger 2]

## Actions
[Step by step what to do]
1. [step 1]
2. [step 2]
3. [step 3]

## Errors Prevented
[Real errors this prevents, with enough context to understand]
- **[Error name or message]**
  [Description of what happens, why it's hard to debug,
  how long it typically takes to figure out]

## Restrictions
[What NOT to do, edge cases to watch for]
```

### Case 2: Amendment

Generate an AMENDMENT.yaml:

```yaml
---
type: amendment
target_skill: [skill-name]
target_version: [current version]
source_sessions: 1
proposed_version: [bumped patch or minor]
---

# Additions

## Actions (append after step [N])
[N+1]. [new step]
[N+2]. [new step]

## Errors Prevented (append)
- **[New error name]**
  [Description of the new error this covers]

## Triggers (append)
- [new trigger condition]
```

### Step 3: Preview and instructions

```
Skill file generated successfully!

  Type: [New Skill / Amendment to X]
  File: .claude/skills/[name]/SKILL.md (or AMENDMENT.yaml)

  To contribute this skill:
  1. Create a new branch: git checkout -b skill/[name]
  2. The file has been placed in .claude/skills/[name]/
  3. Commit: git add .claude/skills/[name]/ && git commit -m "skill: add [name]"
  4. Push and open a PR with the "skill-contribution" template

  [View file]  [Edit before submitting]  [Cancel]
```

### Step 4: Place the file

- For NEW: create `.claude/skills/[name]/SKILL.md`
- For AMENDMENT: create `.claude/skills/[target-skill]/AMENDMENT.yaml`

## Naming Convention

Auto-generate skill names from the experience:
- Use kebab-case
- Start with the domain: `deploy-`, `config-`, `env-`, `migration-`, `setup-`
- Be specific: `rebuild-plugins-before-deploy` not `fix-plugins`
- Max 40 characters

## Tag Auto-Detection

Assign tags based on context:
- File operations on `plugins/`, `extensions/` → `[deploy, plugins]`
- Error in `.env`, config → `[config, environment]`
- Platform-specific issue → `[platform, windows/linux/macos]`
- Database-related → `[database, migration]`
- CSS/UI issue → `[ui, css]`
- AWS/cloud → `[infra, aws]`

## Restrictions

- **Always show the generated file before placing it**: the dev must approve
- **Never overwrite an existing SKILL.md**: for amendments, create AMENDMENT.yaml alongside
- **Keep the language consistent**: if existing skills are in English, write in English
- **Don't invent information**: only include what was actually observed in the session
- **Version bumping for amendments**: patch bump for small additions (1.0.0 → 1.0.1), minor bump for significant additions (1.0.0 → 1.1.0)

## Self-Check

- [ ] The generated file follows the exact SKILL.md or AMENDMENT.yaml format?
- [ ] The name is kebab-case, specific, and under 40 characters?
- [ ] Tags are relevant and consistent with existing skills?
- [ ] For amendments, the target skill and version are correct?
- [ ] The developer reviewed and approved the generated file?
- [ ] Instructions for PR submission were shown?
