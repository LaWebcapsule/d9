---
'@wbce-d9/utils': patch
'@wbce-d9/exceptions': patch
---

security: `_in` validation rules with an empty list (e.g. `$CURRENT_USER.user_roles.role` for a user without roles) now
reject any value instead of accepting everything (GHSA-hxgm-ghmv-xjjm / CVE-2024-39701)
