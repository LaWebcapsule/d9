---
'@wbce-d9/api': patch
---

Fixed a security issue (CVE-2026-35408) where responses were sent without a `Cross-Origin-Opener-Policy` header, so a
cross-origin page that opened the login page could keep a reference to its window and tamper with the SSO flow. The
header is now set to `same-origin` by default and can be changed with `CROSS_ORIGIN_OPENER_POLICY`
(`same-origin-allow-popups` or `unsafe-none`).
