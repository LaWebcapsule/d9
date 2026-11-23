---
'@wbce-d9/app': minor
'@wbce-d9/api': minor
'@wbce-d9/utils': minor
---

Added edit conflict detection, so saving an item no longer silently overwrites changes another user saved in the
meantime. Update payloads can contain `$__meta.onlyIf`, conditions with the values (`_eq`) or SHA-256 digests
(`_sha256`, see `sha256Digest` from `@wbce-d9/utils`) of the values the changes are based on, also in nested items, and
`$__meta.deleteOnlyIf` in nested `delete` alterations. The current values are read with the user's permissions and read
hooks. When a condition isn't met, the whole save is rolled back and the API responds with `409 CONFLICT` and the list
of conflicts. The item page sends these conditions for the item and the items edited in its relational interfaces
(including translations) and shows the conflicting versions to choose from. Requests without conditions behave as
before. Added the `forUpdate` option to reads of the `ItemsService`, which locks the read rows until the transaction
finishes. "Save as Copy" now copies the loaded values when the item was deleted in the meantime, and no longer keeps
loading forever when the item can't be read.
