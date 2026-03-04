---
name: node-v24-windows-escape
description: On Node.js v24 + Windows, escape ! in node -e commands to avoid silent bash history expansion failures.
tags: [environment, windows, nodejs, platform]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 2
  confidence: 0.85
---

# Skill: Node v24 Windows Escape

## Purpose

On Windows with Node.js v24 and bash-like shells (Git Bash, WSL, MSYS2), using `node -e` with expressions containing `!==` or `!=` causes silent failures. The `!` character triggers bash history expansion, which either silently corrupts the command or causes an obscure error unrelated to the actual code.

## Triggers

- Platform is Windows
- A `node -e` command is about to be executed
- The expression contains `!==`, `!=`, or any `!` character

## Actions

1. **Option A (preferred)**: Write the code to a temporary `.js` file and execute it with `node temp.js` instead of `node -e`
2. **Option B**: Escape the `!` character: use `\!==` instead of `!==`
3. **Option C**: Use single quotes instead of double quotes around the expression (works in Git Bash, not in CMD)

```bash
# FAILS silently:
node -e "if (x !== 'y') console.log('different')"

# WORKS - temporary file:
echo "if (x !== 'y') console.log('different')" > /tmp/check.js && node /tmp/check.js

# WORKS - escaped:
node -e "if (x \!== 'y') console.log('different')"
```

## Errors Prevented

- **Silent script failure**: The command exits with code 0 but produces no output or wrong output. The `!` is interpreted by bash as history expansion before Node.js sees it, so the actual code executed is different from what was written. No error message is shown — the command just doesn't do what you expect.
- **Obscure bash error**: In some configurations, you get `bash: !==: event not found` which is confusing when you're writing JavaScript, not bash.

## Restrictions

- This applies specifically to bash-like shells on Windows (Git Bash, MSYS2, WSL bash). CMD and PowerShell handle `!` differently.
- In PowerShell, `!` is not a special character, so `node -e` works normally.
- For complex expressions, always prefer temporary files over `-e` — it's more readable and debuggable regardless of platform.
