---
'@wbce-d9/api': patch
---

security: condition operation errors now only contain the path and type of each failed rule, so webhook flows returning
the last operation data no longer leak `$env`, `$accountability` or other flow data (GHSA-fm3h-p9wm-h74h)
