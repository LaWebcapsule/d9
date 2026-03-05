#!/bin/bash
# session-briefing.sh — Generates a compact briefing from all skills at session start.
# Extracts only the critical info (name, triggers, restrictions) to minimize context usage.
# Runs as SessionStart hook — stdout is injected into Claude's context.

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SKILLS_DIR="$PROJECT_DIR/.claude/skills"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "No skills directory found."
  exit 0
fi

echo "=== SKILLOPS BRIEFING ==="
echo ""

# Count skills
SKILL_COUNT=$(find "$SKILLS_DIR" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "[$SKILL_COUNT skills loaded]"
echo ""

# --- Project-specific skills (d9/) — compact summary ---
echo "## Project Skills (d9/)"
echo ""
if [ -d "$SKILLS_DIR/d9" ]; then
  for skill_dir in "$SKILLS_DIR/d9"/*/; do
    [ -f "$skill_dir/SKILL.md" ] || continue
    name=$(basename "$skill_dir")
    # Extract description from frontmatter
    desc=$(sed -n '/^description:/{ s/^description: *//; p; q; }' "$skill_dir/SKILL.md" 2>/dev/null)
    echo "- **$name**: $desc"
  done
fi
echo ""

# --- Pipeline skills (skillops/) — full triggers + restrictions ---
echo "## SkillOps Pipeline"
echo ""
echo "Flow: detect-xp → match-existing → anonymize-session → format-skill → refine-skill-design → submit-skill → curate-skills (CI)"
echo ""

if [ -d "$SKILLS_DIR/skillops" ]; then
  for skill_dir in "$SKILLS_DIR/skillops"/*/; do
    [ -f "$skill_dir/SKILL.md" ] || continue
    name=$(basename "$skill_dir")

    echo "### $name"

    # Extract first Triggers section only (skip any in code blocks or examples)
    awk '
      /^```/ { in_code = !in_code; next }
      in_code { next }
      /^## Triggers$/ && !found { found=1; next }
      found && /^## / { exit }
      found { print }
    ' "$skill_dir/SKILL.md" 2>/dev/null | head -15

    # For detect-xp specifically, also extract the tier system
    if [ "$name" = "detect-xp" ]; then
      echo ""
      echo "CRITICAL: Check for capturable patterns after EVERY error resolution."
      echo "Tier 1 (ALWAYS propose): silent failures, platform traps, config gotchas"
      echo "Tier 2 (propose if clear): multi-step investigations, workarounds"
      echo "Tier 3 (batch at session end): minor tips, shortcuts"
    fi

    # For submit-skill, remind the full automation
    if [ "$name" = "submit-skill" ]; then
      echo ""
      echo "IMPORTANT: After format-skill, ALWAYS run submit-skill to automate git+PR."
      echo "Do NOT just show manual instructions — execute the branch/commit/push/PR flow."
    fi

    echo ""
  done
fi

echo "## Verification"
echo "- Structure: node scripts/verify-skill-structure.mjs --all"
echo "- Registry: node scripts/verify-registry.mjs"
echo ""
echo "=== END BRIEFING ==="
