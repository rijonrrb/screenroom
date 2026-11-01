# SCREENROOM

Independent SCREENROOM movie/series website and Express admin API. Its deployment is intentionally separate from the portfolio website.

## Live targets
- Website: https://screenroom.devrijonn.com/
- Backend / Studio: https://screenroom.devrijonn.com/screenroom-api/studio/
- Backend health: https://screenroom.devrijonn.com/screenroom-api/health
- Backend cPanel application root: /home/devrijon/screenroom-api (Node.js v22; startup server.js)
- Website document root: /home/devrijon/screenroom.devrijonn.com

The portfolio at https://devrijonn.com/ must **not** host SCREENROOM routes. Links labelled PORTFOLIO navigate to the portfolio domain, not a relative site path.

## Code layout
- watch/ - frontend, catalog, detail, series and player pages. **Contents** deploy to the website document root (not to a nested /watch path).
- screenroom-server/ - Express + MariaDB API, Studio, tests and SQL migrations.
- scripts/deploy_ftps.py - strictly allowlisted FTPS upload; no deletion or overwriting of .env.
- .github/workflows/deploy.yml - Node 22 tests, then automatic deployments of both website and backend on successful push to main.

## Deploy credentials (set as GitHub Actions repository/environment secrets)
- WEB_FTPS_USERNAME and WEB_FTPS_PASSWORD: dedicated FTPS account jailed to /home/devrijon/screenroom.devrijonn.com
- API_FTPS_USERNAME and API_FTPS_PASSWORD: dedicated FTPS account jailed to /home/devrijon/screenroom-api
- FTPS host is nova.hostseba.com over **explicit TLS on port 21** and is already configured in the workflow.

**Never** commit FTP credentials, database passwords, TMDB tokens, R2 keys, or the runtime .env.

Run in a checked-out repository:
~~~
cd screenroom-server && npm ci && npm test
python scripts/deploy_ftps.py --mode screenroom-web --dry-run
python scripts/deploy_ftps.py --mode screenroom-api --dry-run
~~~

## One-time hosting setup
1. Create the dedicated FTPS accounts. Make sure each one is chrooted to its stated destination before setting secrets.
2. From the cPanel Node.js application interface, move the already-created Node app URL to https://screenroom.devrijonn.com/screenroom-api without changing its application root. Keep startup file app.js, Node 22.
3. Upload the production backend, run cPanel **Run NPM Install**, then restart. Later deployments upload source and touch tmp/restart.txt to request a Passenger restart. Confirm this restarts the process on your provider.
4. Set SITE_ORIGIN=https://screenroom.devrijonn.com and APP_BASE_PATH=/screenroom-api in cPanel application environment. Configure dedicated database credentials, ADMIN_USERNAME, ADMIN_PASSWORD_HASH, SESSION_SECRET and TMDB_TOKEN. Configure Cloudflare R2 secrets when ready.
5. Back up the live database; for an existing SCREENROOM database run migrations/001_media_providers.sql **once** (do not run the full schema over live data).
6. Verify HTTPS and the frontend, /health, /api/titles, /studio/, credentials, admin workflows and authorized playback. Do not enable streaming of unlicensed media.
7. Set GitHub Actions production secrets above. From then on, tests must pass before automatic deployment. Actions will fail safely if credentials are missing.

Note: Private R2 HLS still needs authenticated segment proxy. No unlicensed movie embed aggregators are bundled.

### cPanel-managed Apache configuration
The subdomain already has a provider-generated .htaccess containing PHP directives. Do not overwrite it during deployment. It must retain its original directives and include the following settings: Options -Indexes and DirectoryIndex index.html. The FTPS manifest explicitly excludes .htaccess.

## SecureStream Player 0.2.0 integration (2026-11-01)

SCREENROOM uses the pinned SecureStream 0.2.0 ES/CSS bundle from rijonrrb/SecureStream-Player. iPhone Safari/Chrome use Apple native video fullscreen, while other browsers use container fullscreen. The SCREENROOM desktop upload flow converts/remuxes MKV originals into playable MP4 before R2 upload; original unsupported MKV files are not played directly by browsers. Audio track switching depends on browser support, or alternate HLS audio tracks. Pages use versioned asset requests to avoid stale mobile JS/CSS. The backend and Studio auth/metadata code are unchanged by this release.

## SecureStream 0.3 original-container deployment

SCREENROOM uses version-pinned SecureStream 0.3.0. Keep `watch/assets/vendor/movi-element.js` adjacent to `securestream.js`; it is lazy-loaded only for original MKV/AVI/MOV/MKA/legacy containers. Signed R2 object URLs are passed through unchanged. Attach the original R2 key using the matching media format in Studio after the media_assets ENUM migration. Do not upload unsupported/licensed media without authorization. Standard MP4/HLS playback remains on native HTMLVideoElement/hls.js. The browser cannot guarantee that all codecs/profiles, particularly 4K 10-bit HEVC, decode with full fidelity on every device.
