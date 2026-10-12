---
'@wbce-d9/api': patch
---

security: strip the validated payload from condition operation errors so webhook flows returning the last operation data
no longer leak `$env`, `$accountability` and previous operations data (GHSA-fm3h-p9wm-h74h)
