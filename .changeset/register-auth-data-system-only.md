---
'@wbce-d9/api': patch
---

Fixed public registration never activating an account: `GET /auth/login/register/verify-email` answered `403 FORBIDDEN`
for every valid link, and the 60 second limit on confirmation mails was never applied. The local driver wrote the
`system-only` field `auth_data` through a service that carries an accountability, which the payload service refuses.
