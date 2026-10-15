---
'@wbce-d9/api': patch
---

security: fields with the `conceal` special can no longer be used with value-returning aggregate functions (`min`,
`max`, `sum`, `avg`, …) (GHSA-38hg-ww64-rrwc / CVE-2026-35442) and are excluded from search (GHSA-8jpw-gpr4-8cmh /
CVE-2025-64748), to prevent extracting their values
