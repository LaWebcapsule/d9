#!/bin/bash
# detect-xp-reminder.sh — Lightweight reminder after each agent response.
# Checks if the conversation likely involved error resolution.
# Runs as a Stop hook — stdout is injected as a system reminder.

# This script is intentionally minimal to avoid slowing down every response.
# It just outputs a short reminder — the agent decides whether to act on it.

echo "<detect-xp-check>"
echo "REMINDER: If you just resolved an error or completed a multi-step investigation,"
echo "check if this pattern is worth capturing as a skill (see detect-xp)."
echo "Tier 1 patterns (silent failures, platform traps, unexpected dependencies) should ALWAYS be proposed."
echo "</detect-xp-check>"
