---
'@wbce-d9/api': minor
'@wbce-d9/extensions-sdk': minor
---

d9 will move to Node.js 24 in its next major release, scheduled for 2027-01-31, before Node.js 22 reaches its end of
life. The API now logs a warning at startup on Node.js 22. `engines.node` is now `^22` in the API and the extensions
SDK, so npm warns when installing on Node.js 24 or later. See
[Supported Node.js Versions](https://d9.webcapsule.io/self-hosted/node-versions.html).
