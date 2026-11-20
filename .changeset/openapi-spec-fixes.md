---
'@wbce-d9/specs': patch
'@wbce-d9/api': patch
---

Fixed the OpenAPI spec: it validates again, error responses have the shape the API returns, deleting items responds
with `204`, and updating and deleting multiple items is documented, also in the spec generated for each collection
