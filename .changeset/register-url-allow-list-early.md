---
'@wbce-d9/api': patch
---

`POST /auth/login/register` now rejects a `verification_url` that isn't in `AUTH_<PROVIDER>_REGISTER_URL_ALLOW_LIST`
with `400 INVALID_PAYLOAD` before responding, instead of answering `204` and silently sending no email.
