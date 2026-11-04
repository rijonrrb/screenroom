# Screenroom responsive playback patch — 2026-11-04

## Scope

- Ship updated SecureStream Player (same visual controls and reusable plugin) with automatic software decoding fallback for MKV/HEVC, an in-page iPhone viewport fullscreen fallback, and a viewer-selected Resume/Start Over panel.
- Change asset query version to `v=0.3.5` across catalog, title, series and watch pages to avoid stale browser caches.
- Preserve existing black, white and yellow palette, sharp rectangular controls, current catalog/watching layout and content. Make dimensional card hover/touch polish more visible with CSS transforms and pointer-aware light reflection; avoid Three.js/WebGL dependency to keep mobile load small.
- No changes to Studio, server data, database schema, R2 files, signed URL generation or .env.

## QA evidence

- SecureStream 33 Vitest tests passed; build passed.
- Screenroom 7 server tests passed.
- Playwright 320–1440px: title cards, watch page, episode list, related movies, no horizontal overflow, no extra player blank space.
- Real production public VisionQuest data: 8 episodes, next route, correct related movie navigation; artwork preserved.
- R2 stream HEAD/range response: 206 and valid origin CORS; original MKV payloads confirmed.
- Android-emulated Chromium with WebCodecs disabled played original HEVC MKV in software.
- iPhone-emulated Chromium expanded viewport, retaining the existing decoder and controls.
- Resume with real R2 episode from 0:42 progressed to 0:45; Start Over reset to beginning.

## Release limitations / validation

- Actual Safari/iPhone 16 Plus fullscreen and Picture-in-Picture must be manually checked; emulation on Windows cannot confirm iOS browser behavior.
- Raw MKV 10-bit played by a Canvas/WASM pipeline does not guarantee **system PiP on iOS**. A native compatible alternate MP4 or HLS is required for reliable PiP across apps. Do not represent the in-page viewport fallback as Apple's native fullscreen.
- Android device codecs and CPU performance differ; auto software fallback improves compatibility but does not make every source universally playable at original bitrate.
- Existing R2 movies and series objects must not be deleted, converted or uploaded as part of this release.
- After deployment verify Studio login, Admin Logo/Delete, API health, playback audio/subtitles/seek and mobile browser cache refresh.
