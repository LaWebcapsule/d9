---
'@wbce-d9/api': patch
---

Fixed a prototype pollution in the `deep` query parameter: nested keys named after inherited properties (e.g.
`toString.call`) could overwrite a shared built-in and crash the server with one unauthenticated request
(GHSA-gwvv-rr68-cmv6). Every other place the API writes values at a dynamic path (GraphQL nested arguments and aliases,
CSV import column names, schema diffs, share permissions, nested environment config) now uses the same
own-properties-only setter.
