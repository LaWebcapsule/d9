---
'@wbce-d9/api': patch
---

Image transformations now refuse an output larger than `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` on either side with
`400 ILLEGAL_ASSET_TRANSFORMATION`, instead of letting `width`/`height` or a `resize`/`extend` transform allocate an
unbounded image (GHSA-7vcx-mhxq-9j96).
