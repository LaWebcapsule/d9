---
name: detect-xp
description: Detect reusable error/solution patterns during work sessions and propose to contribute them as skills.
tags: [pipeline, skillops, meta-skill]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: skillops-pipeline
related_skills: [match-existing, anonymize-session, format-skill]
---

# Skill: Detect Experience

## Purpose

Monitor the current work session for non-trivial debugging or problem-solving patterns that could be valuable to other developers. When detected, propose to the user to contribute the experience as a shared skill.

This is the entry point of the SkillOps pipeline: detect → match → anonymize → format → PR.

## Triggers

Activate when ALL of the following are true:

- The agent just resolved an error or unexpected behavior
- The resolution required multiple investigation steps (file reads, searches, trial-and-error)
- The root cause was non-obvious (not a typo, not a missing import)

Common patterns to detect:

- **Silent failure**: something fails without error messages, required investigation to find
- **Platform-specific trap**: behavior differs between OS, Node versions, or environments
- **Configuration pitfall**: a setting that seems correct but causes subtle issues
- **Migration gotcha**: something that breaks when upgrading, forking, or rebranding

## Behavior

1. After resolving a non-trivial issue, analyze the recent conversation
2. Identify the pattern: what was the error, what was tried, what was the root cause, what was the fix
3. Summarize in 1-2 sentences
4. Ask the user:

```
I detected a reusable pattern:

  [Summary of the error/solution]

  Error: [what happened]
  Root cause: [why it happened]
  Fix: [what solved it]

Would you like to contribute this as a skill?
  [Yes, contribute]  [No thanks]  [Later]
```

5. If **Yes**: hand off to `match-existing` with the extracted pattern
6. If **Later**: store the pattern summary in the conversation for later reference
7. If **No**: do nothing, continue working

## What to Extract

- **Error description**: what went wrong, exact error messages if any, or description of silent failure
- **Investigation steps**: what was tried, what didn't work
- **Root cause**: the actual underlying issue
- **Solution**: the fix that worked
- **Context**: what tool/framework/version, what operation was being performed
- **Time cost**: rough estimate of how long the debugging took

## Restrictions

- **Never activate on trivial fixes**: typos, missing semicolons, simple config values
- **Never capture without explicit user consent**: always ask before proceeding
- **Never capture secrets or credentials**: even at this stage, avoid including sensitive data in the summary
- **Never interrupt urgent work**: if the user is in the middle of something, wait for a natural pause
- **Maximum 1 proposal per session**: don't spam the user with contribution requests

## Self-Check

- [ ] The detected pattern is genuinely non-trivial (would save someone 15+ minutes)?
- [ ] The summary is clear enough for someone unfamiliar with the project to understand?
- [ ] No sensitive information is included in the initial summary?
- [ ] The user was asked for consent before proceeding?
