---
'@wbce-d9/api': patch
---

security: the `search` query parameter, including `_search` in `deep` and the `filter_count` metadata, only matches the
fields the role is allowed to read, to prevent enumerating the values of the other fields (GHSA-7wq3-jr35-275c)
