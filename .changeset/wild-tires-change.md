---
'@wbce-d9/api': patch
---

Fix getIPFromReq to safely handle undefined IP values by returning an empty string instead of throwing an error
