---
name: refine-skill-design
description: Audit and refactor existing SKILL.md files using meta-audit model for intent, logic, constraints, and examples. Align to spec v2.2.
tags: [writing, eng-standards, meta-skill, optimization]
version: 1.0.0
license: MIT
related_skills: [curate-skills, format-skill, discover-skills]
recommended_scope: user
metadata:
  author: ai-cortex
  integrated_by: la-webcapsule
input_schema:
  type: free-form
  description: A SKILL.md file (path or content) to audit and refine
output_schema:
  type: free-form
  description: Optimized SKILL.md, diff summary, version suggestion
---

# Skill: Refine Skill Design

## Purpose

Audit and improve an existing SKILL.md to maximize its ASQM score. Apply a structured meta-audit across 4 dimensions: intent clarity, behavioral logic, constraint precision, and example quality. Produce an optimized version with a clear diff summary.

## Core Objective

**Primary Goal**: Take any SKILL.md and return an improved version scoring >=17 ASQM (validated threshold).

**Success Criteria**:
1. Every section is present and well-formed (frontmatter, Purpose, Triggers, Behavior, Restrictions, Self-Check)
2. Intent is unambiguous — another agent reading this skill would behave identically
3. Constraints use hard/soft boundary separation
4. At least 2 examples including 1 edge case
5. The diff summary explains every change with rationale

**Acceptance Test**: The refined skill passes `verify-skill-structure.mjs` and scores >=17 on ASQM dimensions.

## Triggers

- Called after `format-skill` generates a new SKILL.md (quality gate before PR)
- Called manually when a skill's ASQM score drops or needs improvement
- Called by `curate-skills` when a skill fails quality checks

## Behavior

### Step 1: Parse and validate structure

Check the SKILL.md for required sections:
```
✅ YAML frontmatter (name, description, tags, version)
✅ Purpose section
✅ Triggers section
✅ Behavior section (with numbered steps)
✅ Restrictions section (hard/soft boundaries)
✅ Self-Check section (checkbox list)
⚠️ Examples section (at least 2, including 1 edge case)
```

### Step 2: Meta-audit across 4 dimensions

**1. Agent-native (0-5)**: Can an AI agent execute this skill without ambiguity?
- Are triggers machine-detectable?
- Are actions concrete (not vague like "consider" or "think about")?
- Are outputs well-defined?

**2. Cognitive (0-5)**: Is the skill cognitively well-structured?
- Single responsibility (one clear job)?
- Appropriate abstraction level (not too broad, not too narrow)?
- Clear decision points (if X then Y, not "use judgment")?

**3. Composability (0-5)**: Does it play well with other skills?
- Clear input/output contract?
- Named handoff points to related skills?
- No overlap with existing skills (check `related_skills`)?

**4. Stance (0-5)**: Are constraints precise and enforceable?
- Hard boundaries use "NEVER", "MUST", "ALWAYS"
- Soft boundaries use "prefer", "when possible", "by default"
- No contradictions between constraints

### Step 3: Apply improvements

For each dimension scoring <4, make targeted improvements:
- Rewrite vague triggers as concrete conditions
- Replace advisory language with actionable steps
- Add missing examples or edge cases
- Separate hard from soft constraints
- Add self-check items for gaps

### Step 4: Output

Present the result as:

```
## Refine Report: [skill-name]

### Scores (before → after)
| Dimension     | Before | After | Change |
|---------------|--------|-------|--------|
| Agent-native  |   3    |   5   | +2     |
| Cognitive     |   4    |   4   |  0     |
| Composability |   3    |   5   | +2     |
| Stance        |   4    |   5   | +1     |
| **Total**     | **14** | **19**| **+5** |

### Changes
| Section | Change | Reason |
|---------|--------|--------|
| Triggers | Added concrete conditions | Was too vague for agent detection |
| Restrictions | Split hard/soft | Mixed severity confused boundaries |
| Examples | Added edge case | Only had happy path |

### Version Suggestion
1.0.0 → 1.1.0 (minor: improved quality, no behavioral change)
```

## Restrictions

### Hard boundaries
- NEVER remove existing examples or restrictions without replacement
- NEVER change the core purpose/intent of the skill
- NEVER introduce dependencies on external services
- NEVER auto-apply changes — always present diff for human review

### Soft boundaries
- Prefer minimal changes over rewrites (smallest diff that maximizes score)
- Prefer adding examples over rewriting existing ones
- When two phrasings score equally, keep the original

## Self-Check

- [ ] All required sections present and well-formed?
- [ ] Each ASQM dimension scored and justified?
- [ ] Diff summary includes rationale for every change?
- [ ] Version bump suggestion follows semver?
- [ ] Refined skill passes structural validation?
- [ ] No meaning/intent drift from original?

## Examples

### Example 1: Improving a weak trigger

**Before** (agent_native: 2):
```markdown
## Triggers
Activate when you notice a deployment issue.
```

**After** (agent_native: 5):
```markdown
## Triggers
Activate when ALL of the following are true:
- A `pnpm build` or `npm run build` command was just executed in `plugins/`
- The build output does NOT include the expected extension files in `extensions/`
- OR: a deployment command was run without a prior build step in the session
```

### Example 2 (edge case): Skill that's already good

**Input**: A skill scoring 18/20 (validated).

**Output**:
```
## Refine Report: preserve-directus-code-identifiers

### Scores (before → after)
All dimensions >=4. No changes needed.

### Recommendation
This skill is already at validated quality. Consider:
- Adding a 3rd example if the skill is frequently referenced
- No version bump needed
```
