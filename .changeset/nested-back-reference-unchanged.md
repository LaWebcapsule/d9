---
'@wbce-d9/api': patch
---

fix: a nested one-to-many update no longer writes the back-reference of a child already linked to its parent, so
updating such a child no longer requires the update permission on that field, like a direct update of the child.
Children linked to another parent, or whose back-reference the user cannot read, still get it written as before (#439)
