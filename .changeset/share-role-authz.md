---
'@wbce-d9/app': patch
---

security: the recommended app permissions no longer let a role choose the role of its shares, which now defaults to the
creator's role (GHSA-pmf4-v838-29hg / CVE-2025-24353)

**Fixing existing roles**: upgrading doesn't change the permissions of existing roles. The role page in the app shows a
warning when a role can still choose the role of its shares; if the warning doesn't show on any role, there is nothing
to fix. Otherwise, for each role showing it, in Settings > Roles & Permissions > _role_ > System Collections > Shares:

1. Create: in Field Permissions, uncheck `role`. In Field Presets, set `{ "role": "$CURRENT_ROLE" }`, so that a share is
   accessed with the role of its creator
2. Update: in Field Permissions, uncheck `role`

Alternatively, for roles with app access, "Reset System Permissions to: Recommended Defaults" applies the fixed
permissions, but overwrites any custom permission on system collections of that role.

Then, as an admin, check the existing shares
(`GET /shares?fields=id,collection,item,role,user_created.email,user_created.role&limit=-1`) and delete those whose role
differs from the role of their creator, or set it to the creator's role.
