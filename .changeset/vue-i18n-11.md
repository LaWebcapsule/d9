---
'@wbce-d9/app': minor
---

security: upgrade vue-i18n from 9 to 11 (GHSA-83rm-6c8r-g728 / CVE-2026-118257, GHSA-8rc2-428q-7ww3 / CVE-2026-118256)

App extensions share the app's vue-i18n: an extension calling `tc` or `$tc`, removed in vue-i18n 11, must call `t` with
the plural count instead. A translation that can't be compiled, such as one containing an email address, is still shown
as is.
