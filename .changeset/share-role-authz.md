---
'@wbce-d9/app': patch
---

security: the recommended app permissions no longer let a role choose the role of its shares, which now defaults to the
creator's role (GHSA-pmf4-v838-29hg / CVE-2025-24353)

Existing roles are not updated: a role that can write the `role` field of `directus_shares` on create or update can
share an item with the permissions of any other role. The role page in the app shows a notice when that is the case. To
fix it, remove the `role` field from the Create and Update permissions of Shares for that role, or reset its system
permissions to the recommended defaults.
