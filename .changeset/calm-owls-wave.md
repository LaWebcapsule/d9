---
'@wbce-d9/api': patch
---

Fixed an open redirect in the SAML ACS endpoint: `RelayState` is now validated against the allowed login redirects
before redirecting, on both the success and error paths
