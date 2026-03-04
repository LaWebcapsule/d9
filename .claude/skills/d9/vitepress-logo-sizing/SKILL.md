---
name: vitepress-logo-sizing
description: Fix VitePress logo distortion in dark mode by setting explicit CSS height instead of unset.
tags: [ui, css, vitepress, docs]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 1
  confidence: 0.75
---

# Skill: VitePress Logo Sizing

## Purpose

When replacing the default VitePress logo with a custom SVG, the logo can appear distorted (stretched or squished) in dark mode. This happens because VitePress's default CSS sets `height: unset` on the logo image in certain theme variants, which removes the height constraint and lets the SVG expand to its intrinsic aspect ratio.

## Triggers

- Custom logo SVGs are being added to a VitePress site
- The logo looks correct in light mode but distorted in dark mode (or vice versa)
- CSS overrides exist in `.vitepress/theme/overrides.css`

## Actions

1. In `.vitepress/theme/overrides.css`, find the logo image rule
2. Replace `height: unset` with an explicit height: `height: 36px` (adjust as needed)
3. Test both light and dark mode to verify the logo renders correctly
4. If using separate light/dark logos, ensure both SVGs have the same viewBox dimensions

```css
/* BAD — causes distortion in dark mode */
.VPNavBarTitle .logo {
  height: unset;
}

/* GOOD — explicit height prevents distortion */
.VPNavBarTitle .logo {
  height: 36px;
}
```

## Errors Prevented

- **Logo distortion in dark mode**: The logo stretches vertically or horizontally depending on the SVG's intrinsic dimensions. Not immediately obvious during development if you only test in one theme mode. Took 1h to identify the CSS rule causing it because the issue is in an override file, not in the main config.

## Restrictions

- The exact pixel value depends on your logo's aspect ratio — `36px` is a starting point
- If you use `width` instead of `height`, test on mobile viewports where the nav bar is narrower
- This applies to VitePress 1.x — future versions may handle logo sizing differently
