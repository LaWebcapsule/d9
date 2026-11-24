---
'@wbce-d9/api': patch
---

`meta=filter_count` and `meta=total_count` now count distinct items instead of joined rows when the filter or the role's
permission crosses a to-many relation.
