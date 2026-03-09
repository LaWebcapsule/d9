# /skillops — Contribute your experience as a shared skill

You are running the SkillOps pipeline. This command orchestrates the full flow to capture a reusable pattern from the current session and submit it as a skill contribution.

## Instructions

Execute the following steps **in order**, stopping at each user confirmation point. Do NOT skip steps or auto-approve.

### Step 1: Detect & Extract

Review the current conversation for reusable patterns (errors resolved, workarounds found, non-obvious configurations). Follow the trigger system from `detect-xp`:

- **Tier 1** (always capture): silent failures, platform traps, unexpected dependencies, config gotchas
- **Tier 2** (capture if clear): multi-step investigations, misleading errors, undocumented migrations
- **Tier 3** (minor): shortcuts, tips

Present each detected pattern to the user:

```
Detected patterns from this session:

  1. [summary] — Tier [N]
  2. [summary] — Tier [N]
  ...

Which patterns do you want to contribute?
[All] [Select by number] [None — cancel]
```

If no patterns are found in the conversation, tell the user and ask them to describe the experience manually.

### Step 2: Match against existing skills

For each selected pattern, read all SKILL.md files in `.claude/skills/d9/` and compare semantically. Follow `match-existing` to determine:

- **DUPLICATE** (>95% similar) → inform and skip (unless user overrides)
- **AMENDMENT** (70-95% similar) → show diff, ask if amendment or new
- **NEW** (<70% similar) → proceed as new skill

### Step 3: Anonymize & decontextualize

Follow `anonymize-session`:

1. Strip all PII, secrets, credentials, internal URLs
2. **Decontextualize**: generalize project-specific details into reusable patterns
3. Show the anonymized version with a list of replacements made
4. **WAIT for explicit user approval** before continuing

### Step 4: Format

Follow `format-skill` to generate:
- **New skill** → `SKILL.md` with proper frontmatter, triggers, actions, errors prevented
- **Amendment** → `AMENDMENT.yaml` with target skill reference and additions

**Include `session_tokens` in the frontmatter.** Ask the user how many tokens were consumed in this session (visible in Claude Code's usage display), or estimate based on conversation length (~500 tokens per agent message exchange). This field tracks the cost of the debugging session so the community can quantify tokens saved by each skill.

Preview the file content to the user. **WAIT for approval.**

### Step 5: Quality check

Run the structure verification:
```bash
node scripts/verify-skill-structure.mjs .claude/skills/<category>/<name>
```

If score < 17, suggest improvements following `refine-skill-design`. If score < 10, do NOT proceed — fix first.

### Step 6: Submit (clean branch)

Follow `submit-skill` to automate the last mile. **CRITICAL SAFETY**:

1. Show what will be committed (files + diff)
2. **WAIT for user confirmation**
3. Stash any uncommitted changes on the working branch
4. Create a **clean branch from `origin/main`** (NOT from the current branch)
5. Cherry-pick ONLY the skill files, registry updates, and verification scripts
6. Commit with message `skill: add <name>` (or `skill: amend <name>`)
7. Push and create PR via `gh pr create` (or show manual instructions if `gh` unavailable)
8. **Return to the working branch** and restore stash
9. Show the PR URL

**Why clean branch?** The user's working branch may contain private work, configs, or secrets. By branching from `origin/main`, only the skill files end up in the PR — zero risk of leaking anything else.

## Important

- **Every step requires user confirmation** — never auto-proceed
- **Nothing leaves the machine until Step 6** — all processing is local
- **The user can cancel at any point** — no side effects until the final push
- **The working branch is NEVER pushed** — only the clean skill/ branch is
- **session_tokens tracks community value** — each skill's token cost helps quantify how much the community saves
- If this is a fresh session with no patterns to detect, ask the user to describe what they learned
