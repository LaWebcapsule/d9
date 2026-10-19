# @wbce-d9/app

## 11.2.0

### Minor Changes

- [#447](https://github.com/LaWebcapsule/d9/pull/447)
  [`490e25e`](https://github.com/LaWebcapsule/d9/commit/490e25e6a1577514c097da123e74ab2f55a8968c) - The default art of
  the login and other public pages is now an animated "crystal" background tinted with the project color, instead of the
  static waves. A custom public background set in Settings still replaces it, and the animation stays still for users
  who prefer reduced motion.

- [#445](https://github.com/LaWebcapsule/d9/pull/445)
  [`2db4d1d`](https://github.com/LaWebcapsule/d9/commit/2db4d1d6c4fa8339c590340bfe14f7595148b3b5) - Clicking the empty
  area below the sections of the open sidebar now closes it, as clicking the closed sidebar opens it. A thin line marks
  where that area starts.

- [#434](https://github.com/LaWebcapsule/d9/pull/434)
  [`20fc79d`](https://github.com/LaWebcapsule/d9/commit/20fc79d568e80de4177bfaccffbbe23f2790914e) - The resizable edge
  of the navigation panel now shows a small grip, so it can be found without hovering. On hover (after the same short
  delay as before) and while dragging, the grip and a thinner 2px line light up in the primary color.

- [#445](https://github.com/LaWebcapsule/d9/pull/445)
  [`2db4d1d`](https://github.com/LaWebcapsule/d9/commit/2db4d1d6c4fa8339c590340bfe14f7595148b3b5) - The sidebar on the
  right can now be resized from its left edge, like the navigation panel: drag between 150px and the room left for the
  page, double-click to reset to 280px; the width is remembered per browser. Dragging it further toward the window edge
  closes it. Its edge shows the same grip as the navigation panel. The navigation panel can now also be made narrower,
  down to 150px (its default stays 220px).

### Patch Changes

- [#433](https://github.com/LaWebcapsule/d9/pull/433)
  [`aba4181`](https://github.com/LaWebcapsule/d9/commit/aba4181682b087ffc0909cc355e4676572d8fa6c) - Fixed the sidebar
  showing every section collapsed after navigating to another page while it was open. The first section (usually
  "Information") is now shown open right away, without the expand animation.

- [#446](https://github.com/LaWebcapsule/d9/pull/446)
  [`0a82510`](https://github.com/LaWebcapsule/d9/commit/0a825102ce18631669bbcd1d21636398f38896d6) - Header action
  buttons no longer collapse behind an expand button on every window narrower than 960px. They now collapse only when
  they would take more than half of the header width, which stays reserved for the title.

- [#449](https://github.com/LaWebcapsule/d9/pull/449)
  [`f95759f`](https://github.com/LaWebcapsule/d9/commit/f95759fb4af879ffb432474b626f549e2c342820) - Fixed the header
  action buttons collapsing in a band of window widths just above 600px and expanding again below it. Only the buttons
  are now compared with half of the header width, so they collapse at a single window width.

## 11.1.0

### Minor Changes

- [#432](https://github.com/LaWebcapsule/d9/pull/432)
  [`d4d8aa9`](https://github.com/LaWebcapsule/d9/commit/d4d8aa999c5515b618555b25e6df914a3d2ad703) - The Project Color
  from Settings is now the primary color of the whole admin UI (buttons, links, toggles, focus rings, selections), not
  only of the logo and favicon. `--primary` and its shades are derived from it with CSS `color-mix()`, using the same
  mixing rules as the built-in palette, in the light and dark themes. Without a project color, or in browsers without
  `color-mix()`, the built-in purple palette is used as before.

## 11.0.1

### Patch Changes

- Updated dependencies []:
  - @wbce-d9/composables@10.0.4

## 11.0.0

### Major Changes

- 70ea742: security: upgrade maplibre-gl from 1.15.3 to 6.11.2 (GHSA-jrc7-96c5-q579). Maps now require WebGL2 (no longer
  displayed on Safari 14 and older or legacy Android browsers). mapbox:// basemaps are resolved through transformRequest
  and map controls are restyled for the maplibregl- class names.

## 10.1.3

### Patch Changes

- @wbce-d9/composables@10.0.3

## 10.1.2

### Patch Changes

- 86d6ce4: security: upgrade storybook 7 -> 8.6.18 to drop the vulerable 'extract-zip' dependecy (CVE-2026-56876)

## 10.1.1

### Patch Changes

- 01c493c: security: fix audit alerts (sanitize-html 2.17.7, nanoid 5.1.16, undici 7.29.0, dompurify 3.4.13 + transitive
  dependency overrides), and release the catalog bumps that were never published (joi 18.2.1, lodash-es 4.18.1, tmp
  0.2.7)
- Updated dependencies [01c493c]
  - @wbce-d9/composables@10.0.2

## 10.1.0

### Minor Changes

- 41d2185: configure (revisions|activity).item to work as a m2a (alias) field
- 41d2185: Add date_created and date_updated on directus_users table

## 10.0.5

### Patch Changes

- b2847d6: Bump vite

## 10.0.4

### Patch Changes

- 1b20ba2: Bump deps

## 10.0.3

### Patch Changes

- eeea793: Fix vulnerabilities

## 10.0.2

### Patch Changes

- 839d3c7: Bump happy-dom to 20.8.9 for security fix

## 10.0.1

### Patch Changes

- 205431f: Bump handlebars to 4.7.9 for security fix

## 10.0.0

### Major Changes

- 6310473: Rebrand Directus 9 to d9 by La Webcapsule: new branding, logos, updated documentation site
  (d9.webcapsule.io), and OpenID client fixes

### Patch Changes

- 5a896e5: Rebrand Directus to d9: update docs, logos, sidebar loader, and fix broken CDN image references

## 9.35.1

### Patch Changes

- c1ae2c0: Bump lodash from 4.17.21 to 4.17.23
- b830a2e: Update @fullcalendar packages
- Updated dependencies [1f4d43f]
  - @wbce-d9/composables@10.0.1

## 9.35.0

### Minor Changes

- 18cfe9c: Add a way to define check constraints through api and web app

### Patch Changes

- 3eb24d9: Bump storybook from 7.0.6 to 7.6.21
  - @wbce-d9/composables@10.0.0

## 9.34.0

### Minor Changes

- a020496: When creating new collection, default id is uuid

## 9.33.8

### Patch Changes

- 3e418cf: Bump happy-dom to 20.0.2

## 9.33.7

### Patch Changes

- Updated dependencies [a561d87]
  - @wbce-d9/composables@10.0.0

## 9.33.6

### Patch Changes

- bdcd952: Security update change, manual and dependabot updates
- Updated dependencies [bdcd952]
  - @wbce-d9/composables@9.29.2

## 9.33.5

### Patch Changes

- 0cc629f: Bump dependencies

## 9.33.4

### Patch Changes

- 49466be: Display directus version instead of api version

## 9.33.3

### Patch Changes

- 3e74c9e: Add transversal session_id for activity audit
  - @wbce-d9/composables@9.29.1

## 9.33.2

### Patch Changes

- @wbce-d9/composables@9.29.1

## 9.33.1

### Patch Changes

- 0a073d4: Bump vite from 4.5.6 to 4.5.10

## 9.33.0

### Minor Changes

- 03314e1: Switched from vm2 to isolated-vm to sandbox the "Run Script" functionality in Flows

## 9.32.0

### Minor Changes

- 40644e2: npm security updates

### Patch Changes

- Updated dependencies [40644e2]
  - @wbce-d9/composables@9.29.0

## 9.31.0

### Minor Changes

- af89302: npm security updates

### Patch Changes

- Updated dependencies [af89302]
  - @wbce-d9/composables@9.28.0

## 9.30.0

### Minor Changes

- 91ab5d6: fix security vulnerabilies and authentification issues

### Patch Changes

- @wbce-d9/composables@9.27.2

## 9.29.1

### Patch Changes

- b59e970: npm security updates
- Updated dependencies [b59e970]
  - @wbce-d9/composables@9.27.1

## 9.29.0

### Minor Changes

- 9d909a7: Cosmetic change on presets panel

## 9.28.0

### Minor Changes

- 7c1b7c7: Fix M2M panel visualization for collections

### Patch Changes

- Updated dependencies [7c1b7c7]
  - @wbce-d9/composables@9.27.0

## 9.27.0

### Minor Changes

- Added bookmark support for users module

## 9.26.4

### Patch Changes

- @wbce-d9/composables@9.26.4

## 9.26.3

### Patch Changes

- f1b4684: change package organization
- Updated dependencies [f1b4684]
  - @wbce-d9/composables@9.26.3

## 9.26.2

### Patch Changes

- 973f4bb: update packages
- Updated dependencies [973f4bb]
  - @wbce-d9/composables@9.26.2

## 9.26.1

### Patch Changes

- 9e4a63a: @directus9
- Updated dependencies [9e4a63a]
  - @wbce-d9/composables@9.26.1
