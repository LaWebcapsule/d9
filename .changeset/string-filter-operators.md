---
'@wbce-d9/utils': patch
'@wbce-d9/types': patch
'@wbce-d9/app': patch
'@wbce-d9/api': patch
---

String fields now accept the case-insensitive `ieq` filter operator in REST and GraphQL, the filter builder offers it,
and validation rules using it are enforced.
