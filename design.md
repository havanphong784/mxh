# Design: MXH

The shared design system for every MXH frontend route. Change deliberately rather than overriding a page in isolation.

## System

- Genre: modern-minimal, adapted for app screens.
- Shape: post stream within the existing navigation shell; dedicated inbox, profile, settings and authentication screens.
- Theme: restrained teal accents on soft off-white/charcoal canvases, requested by the user; preserve the existing layout.
- Axes: light and dark / Vietnamese sans / neutral surfaces with teal interaction states.
- Surfaces: soft off-white canvas and subtly lighter panels in light mode; charcoal canvas and gently raised panels in dark mode. Avoid pure white/black backgrounds and overly bright accents. Teal identifies actions and selected states; restrained red is reserved for errors.
- Preserve Vietnamese copy, routes, forms, handlers and API contracts.

## Tokens

`frontend/src/tokens.css` is the source of truth. Existing names (`--paper`, `--green`, `--display`, etc.) are compatibility aliases to theme roles.

```css
:root {
  color-scheme: light dark;
  --color-paper: light-dark(#f5f5f3, #161819);
  --color-paper-2: light-dark(#eeefec, #242728);
  --color-ink: light-dark(#252a29, #e6e9e7);
  --color-muted: light-dark(#626b67, #a4afaa);
  --color-rule: light-dark(#dcdfda, #333a37);
  --color-accent: light-dark(#286f65, #83c5b5);
  --color-accent-deep: light-dark(#205c53, #a3d6c9);
  --color-accent-ink: light-dark(#ffffff, #16352e);
  --color-accent-soft: light-dark(#e3efea, #233b33);
  --color-focus: var(--color-accent);
  --font-display: "Noto Sans", "Segoe UI", Arial, sans-serif;
  --font-body: var(--font-display);
  --radius-card: 24px;
  --radius-stock: 16px;
  --radius-input: 14px;
}
```

The fixed app type scale, spacing, durations and easing live in `tokens.css`. Typography uses 400 for body, 500 for medium and 600 for emphasis. Noto Sans is hosted locally as WOFF2 in `frontend/public/fonts/`, with Vietnamese glyphs and combining marks in every weight. The font license is included as `OFL.txt`; font-display is swap. No external font service is required.

Typography roles: page titles are 24px (22px on phones), section titles 18px, post copy 16px with 1.65 line height, general interface text 15px, supporting text 14px, metadata 13px and phone navigation labels 12px. Authentication headings are 32px, with the story heading at 40px (32px on phones). Mobile text inputs stay at 16px. Use the same post-copy size for feed and detail views.

Colors use `light-dark()` with native `color-scheme` and require a browser that supports these CSS features. Default appearance follows the system, including live changes. A sun/moon button in the existing top bar and authentication header saves an explicit light/dark choice under `mxh:theme` in localStorage. An early head script restores that preference before rendering; blocked storage falls back to the system while still allowing a session-only choice.

## Controls

- Primary: deep teal with white text in light mode, pale teal with deep teal text in dark mode; 40px minimum visual height, 44px or greater in touch contexts.
- Secondary: neutral panel surface with a defined edge; same input radius.
- Focus: immediate high-contrast teal outline. Selected, unread, pressed and disabled states must remain distinct.
- Authentication story panels follow the active theme's secondary surface and text colors.
- Form edges use muted ink for contrast; rules between content may be softer.
- Icons: one 24px SVG family in `frontend/src/icons.tsx`, with consistent 1.75px strokes. Navigation and like/save controls use matched outline/solid variants; repost switches between plain arrows and arrows with a central check. Save uses a wider ribbon silhouette shared exactly by its outline and solid states. Quote uses curved, filled quotation marks that remain recognizable at 20px. Preserve button labels and aria-pressed semantics. Icons are decorative to assistive technology; the control supplies its accessible name.

## Motion

Brief state feedback only. No page entrance choreography. Reduced motion removes transforms/transitions and stops loaders.

## Exports

`frontend/src/tokens.css` and `frontend/src/base.css`. Screen-specific CSS consumes shared tokens. Desktop uses a centred three-column workspace capped at 1360px: a 208px sticky navigation rail, a flexible post stream, and a 280px discovery column with search above it. Search and discovery share the right-hand track; the content starts at the top of the workspace. Below 1180px, discovery is hidden and search moves above the content. From 731px to 960px, the rail uses icons with accessible labels. Phones retain the bottom navigation and disclosure. Messaging keeps a wide content area without the discovery column. Social page headings are compact, separated by a rule rather than a large filled panel.
