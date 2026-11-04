# SCREENROOM release QA — 2026-11-04

## Changes

- Video player layout: remove the fixed 320px minimum-height that created blank space below 16:9 playback at phone widths.
- Series watch page: episode carousel, previous/next links and in-player navigation, auto-next preference saved to localStorage.
- Movie watch page: related-movie carousel ranked by overlapping genres with other movies as fallback (up to four API pages).
- Catalog images: prefer existing high-resolution landscape backdrops for landscape tiles; display at natural aspect ratio without crop/stretch or extra blank borders. Detail artwork uses its full natural aspect ratio.
- Mobile/tablet responsive spacing, horizontal swipe carousel, accessible arrow buttons and reduced-motion handling.
- Gentle pointer tilt, touch feedback and glass highlights; keep black/yellow/white, square corners and existing overall design.
- Player: WebKit video Picture-in-Picture fallback, separate original-container engine fullscreen / Document PiP routes, and correct Movi `objectfit` mapping for Fit/Fill/Stretch.
- Apple iPhone/iPad uses native HTML video for compatible MP4 to retain system fullscreen and PiP, rather than forcing canvas decoding.

## Automated local checks

Executed on Windows with current GitHub main checkouts in isolated worktrees:

- SecureStream: 29 Vitest tests passed; TypeScript and library build passed.
- Screenroom API: 7 node:test checks passed (prior baseline; rerun before merge).
- Playwright Chrome viewport smoke: 320, 375, 390, 430, 768, 820, 1024 and 1440px; no page overflow, correct episode and related items.
- Player layout: 320–1440px; blank frame difference 2px (normal borders); no control-row overflow.
- Real published catalog artwork: 375, 820, 1440px; image rendered ratio matches source ratio on catalog/detail.
- Real production public API + local JS/CSS overlay: VisionQuest 8 episodes, auto-next Episode 2 -> 3, related movies, image loading and zero horizontal overflow tested at 375/820/1440px. Media streaming was intercepted with a public test MP4; production R2 was not downloaded or modified.

QA script copies are stored in `C:\Users\Rijon\Documents\SCREENROOM-QA-Nov04` (outside this repository).

## Limits and manual verification still required

- **Native iOS/macOS checks are not replaceable by Windows emulation.** On iPhone 16 Plus, test Safari and Chrome: compatible MP4 fullscreen, Picture-in-Picture and returning inline; repeat on iPad Safari.
- Canvas/WASM decoded original MKV and incompatible codecs cannot offer system iOS Picture-in-Picture where WebKit lacks Document PiP; Chromium Document PiP is supported through the original player engine when browser policy allows. The original engine has an iOS viewport-fill fullscreen fallback; this may not hide browser chrome.
- Test player quality/audio/subtitle switching with real authorized samples after deployment. On iOS, native MP4 track selection depends on browser-exposed tracks.
- Check film/series browsing, autoplay on/off, latest episode and final episode, actual R2 URL expiration and mobile screen orientation.
- Validate the GitHub deployment job, public site, Studio login, Logo, Delete, API health, and no regressions. These features were not modified by this patch.
- **Never change production SQL, .env, Cloudflare R2 objects, existing movies or the portfolio as part of this frontend release.**

This checklist is not a claim that all combinations of devices, codecs, and private signed URLs have been proven.
