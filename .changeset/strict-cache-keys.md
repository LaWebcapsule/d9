---
'@wbce-d9/api': patch
---

security: include role, admin/app access, share and share scope in the response cache key so cached responses are no
longer shared between anonymous, share and role contexts that have no user id (GHSA-2mh4-2jfx-3h7r)
