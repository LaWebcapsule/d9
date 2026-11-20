---
'@wbce-d9/api': patch
---

The OpenID auth driver now discovers its provider on first use instead of at boot, so an unreachable provider no longer
exits the API: logins answer `503 SERVICE_UNAVAILABLE` until the provider is back.
