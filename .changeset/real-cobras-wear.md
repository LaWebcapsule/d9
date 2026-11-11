---
'@wbce-d9/schema': patch
'@wbce-d9/utils': patch
---

Built with TypeScript 5.9: `primary()` of the CockroachDB schema inspector is now typed as returning `string | null`, as it
returns `null` when there is no primary key, and `optionToObject` is typed `(option: T | string) => T`
