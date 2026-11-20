---
'@wbce-d9/api': patch
---

The OpenID auth driver no longer exits the API when its provider can't be discovered: the failure is logged at startup
and logins answer `503 SERVICE_UNAVAILABLE` until the provider is back.
