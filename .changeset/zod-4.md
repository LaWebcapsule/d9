---
'@wbce-d9/constants': patch
---

security: upgrade zod from 3 to 4 (GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404)

The extension schemas exported by this package (`ExtensionManifest`, `ExtensionOptions`, …) are now zod 4 schemas.
