---
name: anonymize-session
description: Clean sensitive information from extracted experiences before sharing. Runs entirely locally — nothing leaves without human validation.
tags: [pipeline, skillops, security, meta-skill]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: skillops-pipeline
related_skills: [detect-xp, match-existing, format-skill]
---

# Skill: Anonymize Session

## Purpose

Clean all sensitive, personal, and project-specific information from an extracted experience before it can be shared as a skill contribution. This skill runs ENTIRELY LOCALLY — nothing leaves the developer's machine without explicit human validation.

## Triggers

- Called by match-existing after the developer decides to contribute (new skill or amendment)
- Input: extracted pattern + verdict + target skill info (if amendment)

## Behavior

### Step 1: Identify sensitive content

Scan the extracted experience for:

**Personal Identifiable Information (PII)**
- Email addresses → `[EMAIL]`
- Usernames in paths → `[USER]`
- Full names → `[NAME]`
- Phone numbers → `[PHONE]`

**Secrets and credentials**
- API keys (AWS: `AKIA...`, generic: `sk-...`, `pk_...`) → `[API_KEY]`
- Tokens (JWT, Bearer, OAuth) → `[TOKEN]`
- Passwords and connection strings → `[REDACTED]`
- .env values → `[ENV_VALUE]`
- Private IPs and internal hostnames → `[INTERNAL_HOST]`

**Project-specific context**
- Project names → `[PROJECT_NAME]`
- Company/organization names → `[COMPANY]`
- Internal URLs and domains → `[INTERNAL_URL]`
- Database names → `[DB_NAME]`
- Custom environment variable values → `[ENV_VALUE]`
- File paths containing usernames → `[USER_HOME]/...`
- Repository URLs (if private) → `[REPO_URL]`

### Step 2: Replace sensitive content

Apply replacements in order (most specific first):
1. Secrets and credentials (regex patterns)
2. PII (email, phone, name patterns)
3. Project-specific context (based on known project info from the session)

**Keep generic/useful information:**
- Error messages (with secrets redacted)
- File paths relative to project root (without username)
- Package names and versions
- Framework/tool names
- Command structures (with args redacted if sensitive)

### Step 3: Preview to developer

```
Here's the anonymized version that will be shared:

  Error: [anonymized error description]
  Root cause: [anonymized root cause]
  Fix: [anonymized solution]

  Replacements made:
  - "arthur" → [USER]
  - "deuillotheque-api" → [PROJECT_NAME]
  - "Webcapsule" → [COMPANY]
  - "AKIA..." → [API_KEY]
  - 3 file paths cleaned

  Does this look safe to share?
  [Yes, share]  [Edit first]  [Cancel]
```

### Step 4: Handle response

- **Yes, share**: proceed to format-skill with anonymized content
- **Edit first**: let the developer modify the anonymized text, then re-confirm
- **Cancel**: stop the pipeline, discard everything

## Common Secret Patterns

```
# AWS
AKIA[0-9A-Z]{16}
aws_secret_access_key\s*=\s*\S+

# Generic API keys
(sk|pk|api|key|token|secret|password)[-_]?\w*\s*[:=]\s*\S+

# JWT
eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+

# Connection strings
(mongodb|postgres|mysql|redis):\/\/[^\s]+

# Bearer tokens
Bearer\s+[A-Za-z0-9_-]+
```

## Restrictions

- **NEVER skip the preview step**: the developer MUST see and approve the anonymized version
- **NEVER auto-approve**: even if everything looks clean, always ask
- **NEVER send anything over the network**: this skill runs 100% locally
- **When in doubt, redact**: if unsure whether something is sensitive, replace it
- **Preserve the usefulness**: don't over-anonymize to the point where the skill becomes useless. Keep error messages, tool names, and technical context.

## Self-Check

- [ ] All email addresses removed?
- [ ] All API keys, tokens, and passwords removed?
- [ ] All usernames and personal paths cleaned?
- [ ] Project/company names replaced with placeholders?
- [ ] Internal URLs and IPs redacted?
- [ ] The anonymized version is still technically useful (someone can understand the error and fix)?
- [ ] The developer explicitly approved the anonymized version?
