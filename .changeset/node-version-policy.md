---
'@wbce-d9/api': minor
'@wbce-d9/extensions-sdk': minor
---

d9 will move to Node.js 24 on 2027-01-31, in its next major release, one quarter before Node.js 22 reaches its end of
life. The API now logs a warning at startup on Node.js 22, which `NODE_VERSION_WARNING=false` hides. `engines.node` is
now `^22`, so npm warns when installing on Node.js 24 or later. `@wbce-d9/extensions-sdk` accepts `^22 || ^24`. See
[Supported Node.js Versions](https://d9.webcapsule.io/self-hosted/node-versions.html).
