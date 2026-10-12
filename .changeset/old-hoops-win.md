---
'@wbce-d9/api': patch
---

Fixed a security issue where the OpenID login handler forwarded arbitrary request query parameters into the
authorization request, allowing a caller to override server-set protocol parameters (`redirect_uri`, `state`, `nonce`,
`code_challenge`) or inject others (`client_id`, `response_type`, `request_uri`). Reserved protocol parameters are now
stripped from forwarded query parameters, and the remaining ones are merged before the server-set parameters so the
latter always win. Non-protocol parameters such as Keycloak's `kc_action` continue to work.
