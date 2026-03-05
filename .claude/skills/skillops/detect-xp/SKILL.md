---
name: detect-xp
description: Detect reusable error/solution patterns during work sessions and propose to contribute them as skills.
tags: [pipeline, skillops, meta-skill]
version: 2.0.0
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

This is the entry point of the SkillOps pipeline: detect → match → anonymize → format → refine → PR.

## CRITICAL — Active Monitoring Instructions

**This skill MUST be checked actively, not passively.** The agent MUST evaluate the triggers below at these specific moments:

1. **After every error resolution** — any time an error was encountered and then fixed
2. **After every workaround** — any time the agent had to try an alternative approach
3. **After completing a multi-step investigation** — any time more than 3 tool calls were needed to diagnose an issue
4. **At natural pause points** — before moving to a new task or subtask, review the last 10-20 messages for patterns

**The agent MUST NOT wait for the "perfect" pattern.** A pattern that saves someone 10 minutes is worth capturing. Err on the side of proposing — the user can always say no.

## Triggers

Activate when **ANY ONE** of the following is true:

### Tier 1 — Always trigger (high confidence)
- An error was encountered that required reading documentation or source code to understand
- A fix required modifying something unrelated to the original error (unexpected dependency)
- The same type of error was encountered more than once in the session
- A platform/OS/version-specific behavior caused unexpected results
- A silent failure was discovered (something failed without an error message)

### Tier 2 — Trigger if pattern is clear
- Configuration that seemed correct but caused subtle issues
- A migration/upgrade step that isn't documented anywhere
- An integration between two tools/services that required non-obvious setup
- A build/deploy step that has hidden prerequisites
- An error message that was misleading (pointed to wrong cause)

### Tier 3 — Trigger at session end
- At the end of a long session (>30 minutes of active work), review ALL errors encountered and propose any that match Tier 1 or 2

## Behavior

### Detection Phase

1. When a trigger condition is met, pause and analyze the recent conversation
2. Extract the pattern:
   - **What was the task?** (1 sentence)
   - **What went wrong?** (the error or unexpected behavior)
   - **What was tried?** (investigation steps, failed attempts)
   - **What was the root cause?** (the actual underlying issue)
   - **What fixed it?** (the solution)
   - **Who benefits?** (who would hit this same issue)
3. Estimate time saved: how long would someone spend without this skill?

### Proposal Phase

Present to the user immediately (do NOT wait):

```
💡 I detected a reusable pattern that could help other developers:

  [1-2 sentence summary]

  Error: [what happened]
  Root cause: [why it happened]
  Fix: [what solved it]
  Time saved: ~[estimate]

  Want to contribute this as a shared skill?
  [Yes, contribute]  [No thanks]  [Later]
```

### Handoff Phase

- If **Yes**: hand off to `match-existing` with the extracted pattern
- If **Later**: note the pattern in a brief summary and remind at end of session
- If **No**: do nothing, continue working

## What to Extract

- **Error description**: what went wrong, exact error messages if any, or description of silent failure
- **Investigation steps**: what was tried, what didn't work
- **Root cause**: the actual underlying issue
- **Solution**: the fix that worked
- **Context**: tool/framework/version, OS, what operation was being performed
- **Time cost**: rough estimate of debugging time
- **Reproducibility**: how easily can someone else hit this (always/sometimes/rare)

## Restrictions

### Hard boundaries
- NEVER capture without explicit user consent — always ask before proceeding
- NEVER capture secrets or credentials — even at this stage, avoid sensitive data in the summary
- NEVER auto-proceed to match-existing without user saying "Yes"

### Soft boundaries
- Prefer not to interrupt urgent work — but DO interrupt if the pattern is Tier 1
- Prefer at most 2-3 proposals per session — but if there are more Tier 1 patterns, propose them all
- Prefer to batch Tier 3 patterns at session end rather than one-by-one

## Anti-patterns — Why Detection Fails

Common reasons detect-xp doesn't activate (and how to fix):

1. **"Not non-trivial enough"** — The threshold was set too high. ANY error requiring >3 tool calls to resolve qualifies.
2. **"Waiting for the perfect moment"** — There is no perfect moment. Propose immediately after the fix.
3. **"Only 1 proposal per session"** — This was too restrictive. Propose all Tier 1 patterns.
4. **"The user seems busy"** — A 3-line proposal takes 5 seconds to read. Always propose.
5. **"Not sure if it's project-specific"** — Let match-existing decide that, not detect-xp.

## Self-Check

- [ ] Did I check for patterns after every error resolution in this session?
- [ ] Did I check for patterns after multi-step investigations?
- [ ] Is the detected pattern genuinely useful (would save someone >=10 minutes)?
- [ ] Is the summary clear enough for someone unfamiliar with the project?
- [ ] No sensitive information in the initial summary?
- [ ] Did I propose to the user (not silently skip)?
- [ ] At session end, did I review all unproposed patterns?

## Examples

### Example 1: Silent failure detected

**Context**: Developer runs `pnpm deploy` and the app starts but custom endpoints return 404.

**Investigation**: 5 tool calls — checked routes, checked config, found that `plugins/` wasn't rebuilt before deploy. No error message anywhere.

**Proposal**:
```
💡 I detected a reusable pattern:

  Deploying without rebuilding plugins causes custom endpoints to
  silently return 404. No error message is shown.

  Error: Custom API endpoints return 404 after deploy
  Root cause: plugins/ source wasn't rebuilt — extensions/ had stale build
  Fix: Always run `pnpm build` in plugins/ before deploy
  Time saved: ~45 minutes

  Want to contribute this as a shared skill?
  [Yes, contribute]  [No thanks]  [Later]
```

### Example 2: Platform-specific trap

**Context**: `node -e "if (x !== 1) {}"` fails on Windows with bash.

**Detection**: Tier 1 — platform-specific behavior. `!` triggers bash history expansion.

**Proposal**: Immediate, even if the user is in the middle of something.

### Example 3 (edge case): Multiple patterns in one session

**Context**: A 2-hour Docker setup session with 5 errors resolved.

**Behavior**: Propose Tier 1 patterns immediately as they occur (e.g., after error #2 and #4). At session end, review remaining errors and batch-propose any Tier 2 matches.
