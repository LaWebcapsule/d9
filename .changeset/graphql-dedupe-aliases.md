---
'@wbce-d9/api': patch
---

security: a GraphQL query field returning a scalar, repeated under several aliases with the same arguments, is only
resolved once per request, to prevent amplifying expensive resolvers such as `server_health` (GHSA-6q22-g298-grjh)
