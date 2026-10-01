---
'@wbce-d9/app': major
---

security: upgrade maplibre-gl from 1.15.3 to 6.11.2 (GHSA-jrc7-96c5-q579). Maps now require WebGL2 (no longer displayed
on Safari 14 and older or legacy Android browsers). mapbox:// basemaps are resolved through transformRequest and map
controls are restyled for the maplibregl- class names.
