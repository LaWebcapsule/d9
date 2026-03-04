# Curate Skills

**Status**: validated

## What it does

Evaluates, scores (ASQM **strict**), tags, and normalizes all Skills. Writes `agent.yaml` and normalized `README.md` per skill. Strict scoring: evidence-based; agent_native = 5 only when the skill has an explicit output contract in SKILL.md. Overlaps and market_position describe ecosystem position (metadata only).

## When to use

- After adding or changing skills: re-score and update status
- Audit: review lifecycle (validated / experimental / archive_candidate) and overlap
- Repo summary: generate or refresh ASQM_AUDIT.md
- Self-evaluation: run curation including this meta-skill

## Inputs

- `skills_directory`: root path containing skill subdirectories (e.g. `skills/`)

## Outputs

- Per skill: updated `agent.yaml` (scores, status, overlaps_with, market_position), normalized `README.md`
- Repo-level: `ASQM_AUDIT.md` or structured chat summary
- Overlap and market_position report

## Scores (ASQM)

| Dimension      | Score |
| :---           | :---  |
| agent_native   | 5     |
| cognitive      | 4     |
| composability  | 5     |
| stance         | 5     |
| **asqm_quality** | 19   |

Lifecycle: Quality ≥ 17 AND Gate A and Gate B → validated; Quality ≥ 10 → experimental.

## Ecosystem

| Field | Value |
| :--- | :--- |
| overlaps_with (owner/repo:skill-name) | nesnilnehc/ai-cortex:refine-skill-design, nesnilnehc/ai-cortex:generate-standard-readme |
| market_position | differentiated |

## Full definition

See [SKILL.md](./SKILL.md) for complete behavior, restrictions, and examples.
