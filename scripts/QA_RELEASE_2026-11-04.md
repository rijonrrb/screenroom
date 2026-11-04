# SCREENROOM Release QA — 2026-11-04

## Scope
- Existing SecureStream Player UI, colors, controls, media source handling, and R2 files remain unchanged except fullscreen orientation/geometry fixes.
- iPhone original-container (canvas/MKV) fallback rotates the existing player shell into the available portrait viewport; Android requests Screen Orientation landscape after fullscreen.
- Screenroom host-page CSS no longer overrides the player fullscreen stage height.
- Catalog cards have uniform 16:9 frames (without cropping the original artwork), three-line descriptions, aligned metadata and CTAs.
- Studio sorts media links by Season/Episode and shows each episode title without modifying database records.
- Unreleased episodes show a Coming Soon message, while network errors remain distinguishable.
- Public pages and Studio have new asset-version query strings, reducing stale JS/CSS after a normal refresh.
- Lightweight interactive cinematic wave runs only on the catalog and respects reduced-motion, Save-Data and mobile constraints.
- CSS View Transitions progressively enhance page changes without replacing navigation or the player.
- Picture-in-Picture is explicitly postponed.

## Automated local validation
- SecureStream Vitest: 34 passed.
- Screenroom backend Node tests: 7 passed.
- JavaScript syntax and FTPS dry-run manifests: passed.
- Playwright Chromium: desktop 1440×900, tablet 768×1024, mobile 390×844. Card alignment, filtering, episode carousel and cinematic wave: passed.
- Studio fixture: reversed asset IDs display as S01 E01 and S01 E02, and Edit retains correct media link: passed.
- Unreleased episode fixture: Coming Soon displayed: passed.
- iPhone-like Chromium viewport: original-container canvas fullscreen rotation and bounds checks: passed.
- Git diff whitespace checks: passed.

## Continuous QA
On PRs and pushes to main, GitHub Actions installs Playwright Chromium and runs the test script at scripts/qa_smoke_playwright.cjs, in addition to existing backend and deployment-manifest checks. Tests use fixtures; they do not write production data.

## Manual post-deploy checklist
1. Test a real iPhone Safari with a signed MKV episode: fullscreen, visible progress bar, all controls, device rotation and exit.
2. Test real Android Chrome: portrait, automatic landscape lock, fullscreen, seeking, controls and exit (including with auto-rotate off).
3. Inspect a real catalog with long synopsis/genre values across desktop, tablet and mobile.
4. Inspect Studio ordering for the actual R2 links and multiple seasons; test Edit without changing content.
5. Verify Coming Soon only for missing media and meaningful errors for actual network failure.
6. Verify normal browser reload loads the latest CSS/JS; if HTML is cached long-term, configure HTML revalidation on the CDN/host without blindly overwriting production .htaccess.
7. Verify live API health, Studio login, logo navigation, trailers, signed R2 playback and mobile fullscreen.
8. Keep the database, live titles, R2 objects and .env untouched.

IMPORTANT: Chromium iPhone emulation cannot prove real iOS WebKit behavior. Real device validation remains pending until tested on hardware.
