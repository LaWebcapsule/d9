---
'@wbce-d9/app': patch
---

Fixed the header action buttons collapsing in a band of window widths just above 600px and expanding again below it.
Only the buttons are now compared with half of the header width, so they collapse at a single window width.
