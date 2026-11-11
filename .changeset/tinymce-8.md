---
'@wbce-d9/app': patch
---

security: upgrade the WYSIWYG editor to TinyMCE 8.10.1 (GHSA-mf2p-h6hf-fcwm / CVE-2026-116675)

TinyMCE 8 sanitizes content more strictly: HTML comments that contain tags and attributes with HTML-like values may be
removed when content is opened in the editor.
