---
'@wbce-d9/api': patch
---

Upgraded `graphql` to 16.15.0, which bounds the work spent validating duplicated fields: a query repeating the same
fields many times is now rejected with a GraphQL validation error instead of blocking the API for minutes
(GHSA-7hmh-pfrp-vcx4)
