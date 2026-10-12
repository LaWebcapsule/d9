---
'@wbce-d9/api': patch
---

Pin the transitive `uuid` security override to `^11.1.1` so CommonJS dependencies (e.g. the MSSQL driver's `@azure/msal-node`) can still load it
