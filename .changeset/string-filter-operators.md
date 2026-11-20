---
'@wbce-d9/utils': patch
'@wbce-d9/types': patch
'@wbce-d9/app': patch
'@wbce-d9/api': patch
---

String fields now accept the case-insensitive `istarts_with`, `nistarts_with` and `ieq` filter operators: the API no
longer rejects them, the filter builder offers them, and validation rules using them are enforced.
