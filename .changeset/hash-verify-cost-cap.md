---
'@wbce-d9/api': patch
---

`POST /utils/hash/verify` and the `utils_hash_verify` GraphQL mutation now reject hashes whose argon2 cost parameters
exceed the ones d9 generates with `400 INVALID_PAYLOAD` (GHSA-xw72-c69j-h2rj)
