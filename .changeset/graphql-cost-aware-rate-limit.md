---
'@wbce-d9/api': patch
---

security: when the rate limiter is enabled, a GraphQL request consumes one point per root field of the executed
operation instead of one point per request, so repeating expensive reads under aliases with different arguments counts
against the client IP's budget (GHSA-ph52-67fq-75wj). Raise `RATE_LIMITER_POINTS` if your clients send documents with
many root fields.
