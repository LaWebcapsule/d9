---
'@wbce-d9/app': minor
---

The Project Color from Settings is now the primary color of the whole admin UI (buttons, links, toggles, focus rings,
selections), not only of the logo and favicon. `--primary` and its shades are derived from it with CSS `color-mix()`,
using the same mixing rules as the built-in palette, in the light and dark themes. Without a project color, or in
browsers without `color-mix()`, the built-in purple palette is used as before.
