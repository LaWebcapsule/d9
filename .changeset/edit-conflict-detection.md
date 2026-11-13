---
'@wbce-d9/app': minor
'@wbce-d9/api': minor
'@wbce-d9/utils': minor
---

Added edit conflict detection, so saving an item no longer silently overwrites changes another user saved in the
meantime. Update payloads can contain `$base`, the hashes (`hashValue` from `@wbce-d9/utils`) of the values the changes
are based on, also in nested items, and `$deleteBase` in nested `delete` alterations. When a value changed, the whole
save is rolled back and the API responds with `409 CONFLICT` and the list of conflicts. The item page sends these hashes
for the item and its nested items (including translations) and shows the conflicting versions to choose from. Requests
without `$base` behave as before.
