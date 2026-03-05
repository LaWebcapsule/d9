---
name: discover-skills
description: Identify missing skills and recommend installations from local inventory or public skill catalogs.
tags: [automation, infrastructure, meta-skill]
version: 1.3.0
license: MIT
related_skills: [refine-skill-design, curate-skills, match-existing]
recommended_scope: user
metadata:
  author: ai-cortex
  integrated_by: la-webcapsule
input_schema:
  type: free-form
  description: Task description, capability gap, or user query about available skills
output_schema:
  type: free-form
  description: Skill recommendations with install commands and capability gap analysis
---

# Skill: Discover Skills

## Purpose

Identify capability gaps in the current skill inventory and recommend 1-3 skill installations from known catalogs (local repo, ai-cortex, public skill registries). This helps `match-existing` find skills beyond the local project and helps contributors avoid creating skills that already exist elsewhere.

## Core Objective

**Primary Goal**: Provide the agent with top 1-3 skill recommendations and exact installation commands to fill capability gaps.

**Success Criteria**:
1. Capability gap is clearly identified from the task context
2. Local skills are checked first before searching external catalogs
3. Each recommendation includes rationale (why this skill fits the gap)
4. Install commands are provided and ready to use
5. No installation happens without explicit user confirmation

**Acceptance Test**: The user receives actionable recommendations they can install in under 1 minute.

## Use Cases

- **During match-existing**: extend the search beyond local skills to find cross-repo duplicates
- **New project setup**: identify which skills from the ecosystem would benefit the project
- **Gap analysis**: after a session with many errors, check if existing skills could have prevented them
- **Catalog browsing**: user asks "what skills exist for Docker?" or "are there skills for AWS?"

## Behavior

### Discovery Flow

1. **Understand the gap**: analyze the task description or error pattern
2. **Search local first**: check `.claude/skills/` for matching skills
3. **Search known catalogs**:
   - `nesnilnehc/ai-cortex` (33 skills, meta/review/workflow)
   - `skills.sh` directory (if accessible)
   - GitHub search for repos with `.claude/skills/` or `SKILL.md`
4. **Rank matches**: by relevance to the gap, ASQM score, and freshness
5. **Present recommendations**:
   ```
   I found 2 skills that could help:

   1. review-security (ai-cortex, ASQM 19)
      Covers: SQL injection, XSS, auth bypass patterns
      Install: npx skills add nesnilnehc/ai-cortex/review-security

   2. docker-hardening (community, ASQM 14)
      Covers: Dockerfile best practices, multi-stage builds
      Install: npx skills add user/repo/docker-hardening

   Install one of these? [1] [2] [Skip]
   ```
6. **Confirm before installing**: never auto-install

### Integration with match-existing

When called by `match-existing`, the flow is:
1. Receive the extracted experience from detect-xp
2. Search external catalogs for similar skills
3. Return matches with similarity assessment
4. match-existing combines local + external results for deduplication

## Input & Output

**Input**: Task description, error pattern, or capability gap query. Optionally: list of currently installed skills.

**Output**:
- List of 1-3 recommended skills with: name, source repo, ASQM score (if available), description, install command
- Gap analysis: what the current inventory is missing
- Deduplication note: if the user is about to create something that already exists elsewhere

## Restrictions

### Hard boundaries
- Do NOT install skills without explicit user confirmation
- Do NOT recommend more than 3 skills at once (cognitive overload)
- Do NOT recommend skills with ASQM < 10 (quality floor)
- Do NOT search repositories the user hasn't authorized

### Skill boundaries
- If a skill needs to be created → hand off to `format-skill`
- If a found skill needs quality assessment → hand off to `curate-skills`
- If a found skill needs adaptation → hand off to `refine-skill-design`

## Self-Check

- [ ] Local skills were checked before external catalogs?
- [ ] Each recommendation has a clear rationale?
- [ ] Install commands are correct and ready to use?
- [ ] No more than 3 recommendations presented?
- [ ] User was asked for confirmation before any installation?
- [ ] Deduplication risk was flagged if relevant?

## Examples

### Example 1: Gap detection during work

**Context**: Developer is setting up AWS infrastructure and makes a region configuration mistake.

**Discovery**:
```
I noticed you're configuring AWS services. Your project already has
`ses-eu-west3-setup` but you might benefit from:

1. aws-region-consistency (ai-cortex, ASQM 16)
   Ensures all AWS services use the same region.
   Install: npx skills add nesnilnehc/ai-cortex/aws-region-consistency

Want to install this? [Yes] [No]
```

### Example 2 (edge case): No match found

**Context**: Developer asks about skills for an obscure framework.

**Discovery**:
```
I searched local skills and known catalogs — no skills found for
[framework]. This could be a good opportunity to create one from
your experience. Want to start the contribution pipeline?
[Yes, create a skill] [No]
```
