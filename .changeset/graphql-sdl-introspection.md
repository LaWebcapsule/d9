---
'@wbce-d9/api': patch
---

security: when `GRAPHQL_INTROSPECTION` is disabled, the GraphQL SDL is no longer served by `/server/specs/graphql` nor
by the `server_specs_graphql` query, as it exposes the same schema information as an introspection query
(GHSA-wxwm-3fxv-mrvx / CVE-2026-35413)
