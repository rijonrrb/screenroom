# SCREENROOM Server

Node.js 22, Express and MariaDB backend for portfolio's SCREENROOM catalog and media management.

Hosting configured: cPanel Node 22 production, app root `screenroom-api`, startup `app.js`, mounted at `https://screenroom.devrijonn.com/screenroom-api`.

**Deployment steps**: (1) Assign a dedicated DB user to `devrijon_screenroom`. (2) Import `schema.sql` using phpMyAdmin. (3) Upload contents of this directory to `/home/devrijon/screenroom-api` (outside public_html). (4) Set all secrets in cPanel Node.js environment, never Git. (5) Run npm install and restart. (6) Test `/health`, `/api/titles`, `/studio/` and R2 MP4 signed playback.

Secret config: DB_PASSWORD, ADMIN_USERNAME, ADMIN_PASSWORD_HASH (bcrypt), SESSION_SECRET (64+ cryptographically random chars); TMDB_TOKEN and R2_* credentials for external integrations. Admin login disabled until secrets configured. R2 signed MP4 works for authorized, browser-compatible video; HLS with multiple segments requires a separately authorized Worker/proxy. The R2 bucket must allow intended CORS and range headers. TMDB is metadata only. Only stream licensed media.

## Updated admin workflows (October 31, 2026)

- **TMDB quick search:** Enter a film/series title under Add a Title and choose **SEARCH THIS TITLE ON TMDB**. Select a match; it imports metadata as a draft.
- **TMDB fallback:** If no result appears, search [TMDB](https://www.themoviedb.org/search), copy the exact `https://www.themoviedb.org/movie/123` or `https://www.themoviedb.org/tv/123` URL, then paste it under **MANUAL FALLBACK**. API Bearer token (TMDB_TOKEN) must be configured in cPanel.
- **Video sources:** Default Cloudflare R2 MP4 object key, or Internet Archive / Wikimedia Commons / NASA library discovery, or a direct HTTPS licensed CDN URL. Video source selection is separate from TMDB metadata. Search candidates by title, inspect the source file page and its terms, select its URL, explicitly confirm streaming rights, and attach it to the movie or episode. Public playback continues to use the bundled SecureStream Player.
- **Important:** Internet Archive, Wikimedia Commons, and NASA are public archival/educational sources, **not a guaranteed catalog of commercial films**. Some results have third-party restrictions. Do not publish content without the appropriate license or distribution rights. No unlicensed embed aggregators are integrated.
- **Allowed domains:** Archive sources must be hosted on `archive.org` or subdomains; Commons MP4 on `upload.wikimedia.org`; NASA on `images-assets.nasa.gov`. Custom authorized CDN hosts must be listed in `MEDIA_ALLOWED_HOSTS` as exact comma-separated hostnames.
- **Playback:** External MP4/HLS URLs depend on source permissions and browser CORS; a link that resolves is not proof it plays. Private R2 MP4 uses 15-minute signed GET URLs; private R2 HLS is disabled until a secure segment proxy exists.
- **Database:** For a new installation, import updated `schema.sql`. For an existing database created with the old schema, make a backup and apply `migrations/001_media_providers.sql` **once**; never run both on the same new database.
- **Credentials:** TMDB account + API Read Access Token; Cloudflare account + R2 bucket and S3 API token; cPanel MariaDB username/password and admin login values. Public Archive, Commons and NASA searches need no additional account/API key for the initial workflow. A private CDN may require its own credentials, held outside Git.

Backend and UI are not production-ready until live database import, credentials, TMDB/R2 integrations, actual provider playback, and browser QA succeed.
