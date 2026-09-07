---
'@wbce-d9/api': minor
---

security: lock system fields against client writes. A client-supplied primary key is now rejected on
auto-increment collections, audit fields (`date`/`user`/`role` created & updated) submitted on the action that
doesn't generate them are stripped, and a new `system-generated` special blocks writes to 10 server-derived
fields on `directus_files`, `directus_users` and `directus_shares`. The lock applies to every caller carrying an
accountability, admins and static tokens included; internal services built without one stay exempt. Three
requests that used to return 200 now return 403: importing rows that carry an id into an auto-increment
collection, a `PATCH /files/:id` echoing back `filesize`/`width`/`height`/`metadata`, and a nested m2o create
whose id doesn't exist yet.