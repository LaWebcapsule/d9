---
'@wbce-d9/api': minor
---

Added the `AUTH_<PROVIDER>_REQUIRE_REFRESH_TOKEN` option for the OpenID and OAuth2 drivers (default `true`, which keeps
the current behavior). Setting it to `false` lets users log in and renew their session when the identity provider issued
no refresh token (for example Google when the account has already granted consent), instead of rejecting them with
`INVALID_CREDENTIALS` / "No [OpenID] Session found". A stored refresh token is still checked against the provider.

With the default, a login without a refresh token now redirects once to the provider with `prompt=consent` (as already
done for a revoked token) instead of failing right away, and a stored refresh token is no longer overwritten with `null`
when the provider does not issue a new one on login.
