---
'@wbce-d9/api': patch
'@wbce-d9/storage-driver-s3': patch
---

security: add a metadata-only asset resolution for HEAD requests, only open the storage read stream once an image
transformation has been validated, and release per-read S3 clients when their stream closes, preventing repeated
requests from exhausting the S3 connections and making all assets unavailable
(GHSA-rv78-qqrq-73m5, GHSA-j8xj-7jff-46mx)
