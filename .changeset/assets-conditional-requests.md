---
'@wbce-d9/api': minor
---

`GET` and `HEAD /assets/:id` now answer conditional requests: responses carry a weak `ETag` and `If-None-Match` /
`If-Modified-Since` get a `304 Not Modified` without reading the storage or running the image transformation. The
`Last-Modified` header is now also sent on SQLite, where it was silently missing.
