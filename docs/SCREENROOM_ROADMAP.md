# SCREENROOM — Portfolio Movies & Series

**Status:** Public UI preview and Node.js backend/admin source implemented; live backend deployment pending configuration and QA
**Project owner:** Portfolio website (NOT the standalone SecureStream Player repository)  
**Public section:** `/watch/` (brand: **SCREENROOM**)  
**Private administration:** `/studio/` on an authenticated backend, NOT exposed as an unauthenticated GitHub Pages admin  
**Last reviewed:** 2026-10-31

## Product goal

Extend the existing portfolio with an original, professional movies-and-series browsing interface inspired by streaming products, without copying Netflix/Prime branding, layout assets, or proprietary content. Reuse the Portfolio's **#F5C518 yellow, #0A0A0A black, white**, Space Grotesk / JetBrains Mono type system, flat square-edge cards and borders. Use the independently maintained **SecureStream Player** plugin to play authorized media stored in Cloudflare R2.

Owner uploads/licences media separately in R2. The admin panel records the R2 **object key / HLS manifest path** and media metadata. A verified object and web-compatible stream are then playable. Do **not** assume arbitrary MKV/multi-audio media uploaded unchanged can be played by browsers.

## Technical situation verified

- Existing portfolio repository: `rijonrrb/Rijon-Portfolio-Website` (private). Current home page is static HTML with Tailwind CDN, CSS and JavaScript.
- Existing player repository: `rijonrrb/SecureStream-Player`; keep its README and roadmap scoped to the reusable player library.
- PHP/MySQL/phpMyAdmin hosting reportedly available, **hosting PHP version, Composer, Laravel support, HTTPS, rewrite rules and cron are unverified**.
- Never deploy authentication, database credentials, R2 secrets or a TMDB secret to a static GitHub Pages bundle.

## Architecture (recommended, subject to hosting inspection)

```
Portfolio static website  /watch/       Admin app /studio/ (server-authenticated)
       |                                        |
       +------------ HTTPS JSON API -----------+
                            |
                   PHP/Laravel API
                     /       |      \
                 MySQL      TMDB     Cloudflare R2
              catalog DB   metadata  object key + protected access
                            |
                    SecureStream Player (browser)
```

- Frontend: preserve the existing portfolio site and introduce a self-contained `watch/` frontend, initially as HTML/CSS/TypeScript or JavaScript with a documented API contract. Upgrade routing only if needed.
- Backend: Laravel + MySQL **if** existing hosting meets Laravel's runtime requirements; otherwise choose a PHP-supported API implementation or a separately hosted backend. Do not use phpMyAdmin as an API or expose it publicly for the application.
- Media: use existing Cloudflare R2 storage; store **object keys**, stream type (HLS/MP4), codecs, captions and audio-track metadata. Do not expose account tokens/keys.
- Playback: SecureStream via package build; use secure delivery URLs as playback sources.
- TMDB: server-side token, search movies or TV shows, fetch details and seasons/episodes, cache metadata locally, permit manual corrections. TMDB is **metadata only**, not a media hosting source.

## UX / routes

| Public route | Purpose |
| --- | --- |
| `/watch/` | SCREENROOM catalog: featured hero, recently added, Movies, Series, genre sections, search and filtering. |
| `/watch/title/?id=<slug>` | Title detail: poster/backdrop, synopsis, year, genre, runtime, cast, rating, trailer, Watch button. |
| `/watch/play/?id=<slug>&episode=<id>` | Video playback with SecureStream, selected subtitle/audio and continue watching. |
| `/watch/series/?id=<slug>` | Series detail with season selector, episode list, descriptions, thumbnails and duration. |

Because GitHub Pages does not provide custom dynamic route rewriting, initial portfolio-static routing must use physical page paths or query parameters. Clean rewrite paths can be introduced only if hosting/router configuration supports them.

| Admin route (authenticated backend) | Purpose |
| --- | --- |
| `/studio/login` | Restricted sign-in, CSRF protection, rate limiting. |
| `/studio/titles` | Movies/series CRUD, draft/published states, search, edit, delete. |
| `/studio/titles/create` | Select Movie or Series, search TMDB, import metadata and edit fields. |
| `/studio/titles/{id}/seasons` | Series seasons, episode ordering and TMDB episode import. |
| `/studio/media` | Attach R2 object key to a movie/episode; verify HEAD/object existence. |
| `/studio/trailers` | Add a permitted uploaded trailer key or validated external trailer URL. |

## Administrator flow (no unnecessary re-upload)

1. Upload/licence the movie, episode or trailer into Cloudflare R2 using the R2 dashboard or authorized upload tool. Optionally, add direct-to-R2 upload from the admin later.
2. Sign into `/studio/`, select **Movie** or **Series**, search the name using TMDB API and choose the correct match; auto-populate title, description, genre, posters, artwork, cast, release year, runtime, seasons and episode summaries when available.
3. Set R2 **bucket/object key** (preferred to a full expiring signed URL) for the movie or each episode; attach trailer, external VTT or HLS caption information when available. Validate file and manifest compatibility.
4. Preview playback, select availability and publish. Public catalog and details become visible.
5. For a series, attach individual source files per episode with seasons and sorting; avoid using one source for all episodes.

## Initial database tables / entities

- `users`: authenticated administrators with hashed passwords and role, audit metadata.
- `titles`: ID, slug, kind = movie|series, TMDB ID, title, original_title, synopsis, year, genres, posters, backdrop, languages, publication status, timestamps.
- `seasons`: title_id, season_number, name, synopsis, poster.
- `episodes`: season_id, episode_number, name, description, still, runtime, publish status.
- `media_assets`: owner_kind/title_id/episode_id, role = feature|episode|trailer|subtitle, R2 bucket/object_key, format = hls|mp4|vtt, MIME type, duration, status, language.
- `playback_progress`: optional authenticated viewer/title/episode position (or local player resume for anonymous).
- `audit_logs`: administrator, action, subject, timestamp.

Use unique constraints on title slug and episode (season_id, episode_number), foreign keys, input validation and indexed published/search fields. A title may have many assets; each episode should link to the correct playback asset.

## API contract, first pass

- `GET /api/watch/titles?type=movie|series&q=&page=`: paginated, published catalog.
- `GET /api/watch/titles/{slug}`: safe metadata with seasons/episodes as appropriate.
- `GET /api/watch/titles/{slug}/episodes?season=`: paginated series episode data.
- `GET /api/watch/playback/{assetId}`: verify access, then return a short-lived authorized playback URL or Worker streaming endpoint; never R2 secret credentials.
- `POST /api/admin/login` + `POST /api/admin/logout`: secure session and CSRF.
- `GET /api/admin/tmdb/search?type=&q=`: server-side TMDB proxy.
- `POST /api/admin/titles`, `PATCH /api/admin/titles/{id}`, `POST /api/admin/episodes`: protected CRUD.
- `POST /api/admin/assets/verify`: verify R2 key/manifest/MIME.
- `POST /api/admin/titles/{id}/publish`: reject if required media is missing or invalid.

## Cloudflare R2 and media caveats

- Use private bucket + authorization. For a single object, backend can generate a time-limited R2 S3 **GET presigned URL**; use a Worker bound to R2 or another appropriately authenticated delivery pattern for HLS playlists and many segments. A signed single manifest does **not** automatically authorize all relative segments.
- Preserve byte-range support for seekable MP4. Apply correct CORS and Content-Type for MP4, HLS `.m3u8`, HLS segments, and VTT.
- SecureStream can list advertised alternate audio/subtitle tracks in an HLS master manifest, plus browser-supported text tracks. Embedded MKV streams often require remuxing/transcoding to browser-supported MP4/HLS and subtitle extraction; arbitrary uploads are not guaranteed to play.
- R2 stores objects; it does not automatically create multiple quality renditions or transcode movies. The processing workflow, if needed, is a separate implementation milestone.
- Only upload/stream works for which the owner has the necessary copyright or distribution rights.

## TMDB integration / compliance

- Search movie and TV separately; details may include cast, backdrop, poster, genres, release date, trailer/video information. For series, request season details to get episode stills, overviews, runtime and numbers.
- Handle missing or imperfect metadata through manual edit; cache responses and honor rate limits.
- TMDB API key/token stays on the server. TMDB metadata is **not a streaming source**.
- Required About/Credits attribution: `This product uses the TMDB API but is not endorsed or certified by TMDB.` Display approved TMDB logo per their requirements. Check commercial licensing before monetizing the platform.

## Build sequence and acceptance criteria

### Phase 0 — Hosting audit / design baseline
- [x] Confirm existing portfolio front-end stack and theme from its GitHub repository.
- [x] Confirm SecureStream is a separate, tested library.
- [ ] Inspect actual hosting runtime, PHP version, Composer/CLI, MySQL, HTTPS, domain and rewrite capabilities (no secret disclosure).
- [ ] Identify R2 bucket integration pattern and whether supplied media is MP4/HLS/MKV.
- [ ] Decide publicly browsable vs restricted viewer access.

### Phase 1 — Public SCREENROOM frontend
- [ ] Build responsive `/watch/` route with black/yellow/white flat rectangular card design, original visual hierarchy, loading/empty/error states.
- [ ] Detail pages for movie vs series, season/episode cards and trailer UI.
- [ ] Hook SecureStream playback component to an API-supplied source; maintain video frame size and track menus.
- [ ] Accessibility and mobile/desktop QA.

### Phase 2 — Secure admin / database
- [ ] Back-end auth, migrations and input validation; protect all mutation endpoints.
- [ ] Title, season, episode, trailer and media-key CRUD with drafts/publishing.
- [ ] TMDB title search/import/edit and attribution.
- [ ] API responses and pagination.

### Phase 3 — R2 delivery and real media
- [ ] Store bucket/object keys (never credentials in public JS/DB outputs).
- [ ] Verify media key and playback readiness; implement authenticated URL signing or protected Worker streaming.
- [ ] Validate seek, captions, multi-audio and quality switching with actual uploaded samples.
- [ ] Test browser compatibility, MIME, CORS, Range, 404/403, timeouts and large files.

### Phase 4 — Release / operational quality
- [ ] Unit + integration + browser QA, admin authorization tests, mobile tests.
- [ ] Set deployment environment variables, CORS, backups, migration/rollback plan and error logs.
- [ ] Deploy staged changes, then production after owner verification; do not break existing portfolio routes.

## Required environment information (later, through a secure authorized connection)

- Hosting provider, control panel, site domain and PHP/Composer availability; never send passwords in chat.
- R2 account/bucket settings, allowed object paths and access permissions. Keep API credentials in server environment/secret storage.
- TMDB API credential entered through server secret settings, **not** committed to GitHub or copied into frontend code.
- One authorized test movie and one series episode (prefer HLS with audio/subtitle variants) for end-to-end QA.

## References (official)

- TMDB search/detail docs: https://developer.themoviedb.org/docs/search-and-query-for-details
- TMDB season episodes: https://developer.themoviedb.org/reference/tv-season-details
- TMDB API/attribution terms: https://developer.themoviedb.org/docs/faq
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare R2 PHP SDK: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-php/

## Live deployment handoff — 2026-10-31

- **Provisioned on live hosting:** cPanel Node.js 22.23.4, Production, app root `/home/devrijon/screenroom-api`, startup `app.js`, URL `https://devrijonn.com/screenroom-api`.
- **Provisioned database:** `devrijon_screenroom` in live MariaDB. No tables or database-specific user have been provisioned yet.
- **Implemented and tested locally:** `screenroom-server/` (Express/MySQL API, session auth, TMDB import, R2 signed MP4, standalone admin UI), `screenroom-server/schema.sql`, and `/watch/` API hydration + embedded SecureStream Player, trailer support, TMDB art. Demo data remains a fallback while backend is unavailable.
- **GitHub:** private portfolio `main` holds backend source and updated public UI. No database passwords, TMDB token, or R2 credentials are committed.
- **Blocked:** cPanel File Manager reported an expired login. User must sign in to cPanel again to deploy `screenroom-api-deploy.zip`; database wizard's user/password creation is also not completed. Import SQL, set production env variables, run npm install in cPanel, restart, then verify `/health`, auth, CRUD, R2, CORS and live pages.
- **Media limits:** Signed private MP4 URLs are supported in code; HLS playlists with multiple segments require a separately implemented protected Worker/proxy. R2 storage alone does not transcode arbitrary media files.
- **Testing remaining:** live DB connection, real secure admin login, authorized R2 object, published title detail, series episode playback, TMDB metadata/search, mobile and Safari browser validation.
