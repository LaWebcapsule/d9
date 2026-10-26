---
'@wbce-d9/app': patch
---

Optimize the animated crystal background on public pages by caching rendered crystals, capping rendering at 60 FPS,
coalescing resize updates and pausing the animation while it is not visible.
