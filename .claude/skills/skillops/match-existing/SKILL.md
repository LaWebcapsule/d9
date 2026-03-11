---
name: match-existing
description: Compare an extracted experience against existing skills to determine if it's new, an amendment, or a duplicate.
tags: [pipeline, skillops, meta-skill]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: skillops-pipeline
related_skills: [detect-xp, anonymize-session, format-skill]
---

# Skill: Match Existing Skills

## Purpose

After detect-xp extracts a pattern, this skill compares it against all existing skills in the repository. The goal is to determine whether the experience creates a NEW skill, AMENDS an existing one, or is a DUPLICATE.

This comparison happens BEFORE anonymization so the developer sees the diff in their real context and can make an informed decision.

## Triggers

- Called by detect-xp when the user agrees to contribute an experience
- Input: the extracted pattern (error, root cause, solution, context)

## Behavior

### Step 1: Load existing skills

Read all SKILL.md files from the `LaWebcapsule/d9-skills` repo. Either:
- Use `gh api` to list and read skill files from the remote repo
- Or if a local clone exists (e.g., from a previous submit), read from there
- Fallback: read from `.claude/skills/d9/` if available locally

### Step 2: Compare semantically

For each existing skill, compare:
- Are the triggers similar? (same commands, same file patterns, same context)
- Are the errors prevented similar? (same root cause, same symptoms)
- Are the actions similar? (same fix, same workaround)

### Step 3: Determine verdict

**DUPLICATE (similarity > 0.95)**
```
This experience is already covered by: [skill-name]

  Existing skill: [skill description]
  Your experience: [extracted pattern]

  Nothing new to add.

  [OK, cancel]  [No, it's different — force new]
```

**AMENDMENT (similarity 0.7 - 0.95)**
```
This looks like it improves: [skill-name] (v[version])

  EXISTING SKILL:
  ✓ [existing action 1]
  ✓ [existing action 2]
  ✓ [existing error prevented]

  YOUR EXPERIENCE ADDS:
  + [new action or detail]
  + [new error prevented]
  + [new trigger condition]

  [Complete this skill]  [It's a new skill]  [Cancel]
```

**NEW SKILL (similarity < 0.7)**
```
No matching skill found. This will be contributed as a new skill.

  Name suggestion: [auto-generated-name]
  Category: [auto-detected domain]

  [Continue]  [Cancel]
```

### Step 4: Hand off

- If **DUPLICATE + user accepts**: stop, no further action
- If **DUPLICATE + user forces**: treat as NEW, proceed to anonymize-session
- If **AMENDMENT + user confirms "Complete"**: proceed to anonymize-session with amendment context (target skill + additions)
- If **AMENDMENT + user says "New skill"**: proceed to anonymize-session as new skill
- If **NEW**: proceed to anonymize-session

## Output

Pass to anonymize-session:
- `verdict`: "new" | "amendment"
- `target_skill`: skill name (only if amendment)
- `target_version`: skill version (only if amendment)
- `extracted_pattern`: the full extracted experience
- `additions`: what's new vs existing (only if amendment)

## Restrictions

- **Do NOT skip this step**: even if the user thinks it's new, always check
- **Do NOT compare with pipeline skills**: only compare with d9 experience skills
- **The developer always has the final say**: if they say it's different, treat it as new
- **Show the full diff for amendments**: the dev must see exactly what they're adding

## Self-Check

- [ ] All existing skills in .claude/skills/ were read and compared?
- [ ] Pipeline/meta skills were excluded from comparison?
- [ ] The verdict was clearly communicated to the user with actionable options?
- [ ] For amendments, the diff between existing and new is clearly shown?
- [ ] The developer made an explicit choice before proceeding?
