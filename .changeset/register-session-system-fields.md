---
'@wbce-d9/api': patch
---

Register `directus_sessions.session_id`, `directus_sessions.fallback_token` and `directus_activity.session_id` as system
fields so schema snapshots no longer export them and schema apply can no longer drop them (#478)
