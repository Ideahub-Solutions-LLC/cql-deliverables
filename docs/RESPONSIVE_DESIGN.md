# Responsive layout

The app uses fluid page widths and a shared mobile-first stylesheet in `app/responsive.css`. Root layout imports the base, workspace, sign-in, and responsive styles in that order so the same rules apply on direct page loads and navigation. No backend, database, account, or deployment changes are required.

## Recommendations applied

- Start with a single column and add columns when content has enough room. Breakpoints follow layout needs instead of device brands.
- Use available desktop width with fluid page gutters. Profile and sign-in forms retain readable line lengths within the full-width page.
- Use zero minimum grid tracks, wrapping text, and flexible controls so long names, evidence, and titles do not widen the page.
- Collapse both navigation shells below 1024 CSS pixels. Hidden navigation is inert; opening it moves focus inside, traps Tab, supports Escape, locks background scrolling, and restores focus when closed.
- Keep wide boards, schedules, and timelines in labeled, keyboard-focusable scroll regions. These views intentionally scroll horizontally rather than compressing all their columns into a phone screen.
- Stack form fields below 640 pixels. Enlarge key touch controls to at least 44 pixels and use 16-pixel mobile form text. Preserve pinch zoom, safe-area spacing, reduced-motion preferences, and drawer actions in short landscape viewports.
- Bound notification panels to the viewport and allow long messages to wrap.

Sources consulted on November 7, 2026:

- [web.dev: Responsive web design basics](https://web.dev/articles/responsive-web-design-basics) — fluid layouts, small-screen-first breakpoints, and content-driven layout changes.
- [MDN: Responsive design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design) — flexible grids, media queries, viewport setup, and responsive media.
- [MDN: Media query fundamentals](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Media_queries) — mobile-first enhancement and input-capability queries.

## Verification

`node scripts/test-responsive.mjs` runs real client components in headless Chromium using an isolated, read-only fixture server. It does not log into or modify an application database. Synthetic API responses include long unbroken titles and notification messages. The fixture substitutes an ordinary anchor for Next's Link component and uses the authored layout CSS; it does not exercise server rendering, authorization, or persistence.

The test requires Playwright and Chromium in the test environment. If they are not installed in the project, set `PLAYWRIGHT_MODULE` to an available Playwright package and `CHROMIUM_PATH` to the Chromium executable. Set `APP_URL` to a running local application to additionally check the actual sign-in and signup routes, including the viewport metadata and compiled styles. No credentials are needed.

Widths: 320, 375, 430, 640, 768, 1023, 1024, 1280, 1920, and 2560 pixels. Coverage includes workspace/project screens, profile, settings, password, user management, workspace creation, signup, sign-in, all delivery views, project schedule/recovery, add-deliverable drawers, notification panels, navigation focus, phone landscape, reduced motion, and a profile at 200% zoom.

The script rejects document-wide horizontal overflow, visible content outside the viewport, and browser runtime errors. Wide desktop checks also verify that workspace content expands beyond the former width cap. Results and screenshots are written to ignored `work/responsive/`.

Additional checks: `npx tsc --noEmit --incremental false`, focused ESLint checks for the new navigation hook and test runner, and `npm run build`. Browser coverage is Chromium emulation; physical-device and Safari/Firefox checks remain useful before a public release.
