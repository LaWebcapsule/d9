---
'@wbce-d9/api': patch
---

Fixed a prototype pollution in the `deep` query parameter: nested keys named after inherited properties (e.g.
`toString.call`) could overwrite a shared built-in and crash the server with one unauthenticated request
(GHSA-gwvv-rr68-cmv6).
