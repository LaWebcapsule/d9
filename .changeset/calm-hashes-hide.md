---
'@wbce-d9/api': patch
---

security: `hash` fields are now concealed on read, like `conceal` fields, so their value is no longer stored in clear text
in revisions when an item is created, and their hash is no longer returned by the API (GHSA-mvv8-v4jj-g47j).
