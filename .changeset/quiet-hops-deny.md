---
'@wbce-d9/api': minor
---

security: file import from URL now only connects to public IP addresses, checked on every redirect hop through
request-filtering-agent, and follows at most 5 redirects (GHSA-xhgj-x4mj-6c93). Importing files from private IP
addresses now fails unless they are listed in the new `IMPORT_FILE_IP_ALLOW_LIST` (IPs or CIDR ranges).

`IMPORT_IP_DENY_LIST`'s `0.0.0.0` entry now also denies IPv6 local interface addresses (e.g. `::1`), as documented.
This applies to webhooks and Flows too: requests to `localhost` resolving to `::1` are now denied.
