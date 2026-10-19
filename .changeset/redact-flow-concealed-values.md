---
'@wbce-d9/api': patch
---

security: concealed fields (such as user passwords and tokens) of the payload received by an event-triggered flow are
now masked in the "Log to Console" operation output and in the flow run revisions (GHSA-x3vm-88hf-gpxp)
