---
'@wbce-d9/api': patch
---

Register `directus_sessions.session_id`, `directus_sessions.fallback_token` and `directus_activity.session_id` as system
fields so schema snapshots no longer export them and schema apply can no longer drop them, and ignore system fields
listed in snapshots from older versions so those snapshots still apply (#478)
