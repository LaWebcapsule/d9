---
'@wbce-d9/api': patch
---

security: the OpenAPI specification served by `/server/specs/oas` now only exposes the exact running version in
`info.version` to admins, like `/server/info`; other users get `0.0.0-hidden` (GHSA-rmjh-cf9q-pv7q)
