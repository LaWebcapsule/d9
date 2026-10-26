---
'@wbce-d9/api': patch
---

security: the `authorization` and `cookie` headers and the `access_token` query parameter of the request that triggers a
webhook or manual flow are redacted in the log operation and in the flow logs, so that admins can't hijack the session
of the user (GHSA-f24x-rm6g-3w5v)
