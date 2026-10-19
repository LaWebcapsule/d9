---
'@wbce-d9/api': patch
---

security: password reset requests now always take at least the same minimum time, whatever the outcome (invalid
`reset_url`, unknown or inactive user, mail error), so response timing no longer reveals whether an account exists
(GHSA-jr94-gj3h-c8rf).
