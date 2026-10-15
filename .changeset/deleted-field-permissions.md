---
'@wbce-d9/api': patch
---

security: deleting a field now removes it from the permissions of its collection, so a field later created with the same
name no longer inherits the deleted field's access (GHSA-9x5g-62gj-wqf2 / CVE-2025-64746)
