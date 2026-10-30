---
'@wbce-d9/schema': minor
'@wbce-d9/api': minor
'@wbce-d9/app': minor
---

Added an "Indexed" checkbox to the advanced field creation mode. It creates (or drops) a plain single-column index on
the field's column. The state is read from the database, so it is also exposed as `schema.is_indexed` in the fields API,
GraphQL and schema snapshots.
