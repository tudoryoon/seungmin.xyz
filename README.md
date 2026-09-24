# Seungmin Personal Realm

Cloudflare Pages site with static pages and one public RSS Function. No build step. Serve the repository root over HTTP.

Run `node dev-server.mjs` for a local preview at http://127.0.0.1:4173 (or pass another port).
Keep interface copy literal and minimal. No slogans, lore captions, motivational lines, or personality interpretations.

## Current Flow

Scroll-through portal -> public Substack / 개인일정 / About menu. Only 개인일정 opens Supabase email login -> profile -> text-driven pixel avatar -> dungeon map; complete signed-in accounts go directly to their map. Substack expands an inline post list and reader at `#substack`. Its profile address appears only at the bottom of the reader. About displays exactly 개인 페이지입니다. Public content opens beneath the horizontal navigation; selecting its active link collapses it. Login retains the navigation, and a back-arrow control returns private screens to the public menu.

## Public Posts

`functions/api/substack.js` fetches only `https://tudoryoon.substack.com/feed`, without cache-busting queries or visitor credentials. It has an 8-second upstream timeout, a 3 MiB limit, and strict XML validation. Last-good public RSS is kept in the edge cache for up to 30 days, refreshed after five minutes. Stale/cold requests return immediately while `waitUntil` refreshes in the background. Since edge storage can be evicted, `data/substack-snapshot.js` also bundles a real public-feed copy with the site. Failed, invalid or unexpectedly empty responses never replace existing posts. Response headers expose the source and capture time. `_routes.json` invokes the Function only for `/api/substack` and its trailing-slash variant. No secret, database, private Substack account access, or paid service is configured. Pages Functions usage follows the account's existing Cloudflare plan.

The browser renders the bundled snapshot immediately, then restores any newer successful feed from localStorage. It fetches lazily on opening Substack, parses RSS with native DOMParser and displays up to 30 recent public entries. Visible readers check once per minute, including focus/visibility/online recovery, while the edge freshness window remains five minutes. Other pages and background tabs do not fetch. Older fallback responses cannot overwrite newer browser data. Failed requests retain readable posts and expose a retry icon, without replacing them with an error screen. Storage failures are nonfatal. Refresh preserves scroll, keyboard focus and the currently open article. Titles/authors use text nodes; article HTML is sanitized with vendored DOMPurify 3.4.15 and restricted to reading markup. Scripts, embeds, forms, style attributes and unsafe URLs are removed. Images are restricted to the publication and Substack CDN; links use noopener/noreferrer. Only public RSS content is shown; a paid or truncated post stays truncated, with an explicit original-post link. New posts appear after the RSS/cache refresh, without code changes. Upstream outages can delay new posts, but do not blank the saved list. No signup, subscription purchase or user-data import is performed.

Refresh the deployable public baseline with `node scripts/update-substack-snapshot.mjs`, review its diff, and deploy it with the code. This is not a scheduled job or durable latest-feed database. If deliberately removing all posts or making previously public content private, also remove/update the deployed baseline and invalidate the public browser/edge cache keys; failure protection intentionally retains old content during an empty-feed response. The server-side XML parser is vendored saxes 6.0.0 plus xmlchars 2.2.0, bundled with esbuild 0.25.12 (`esbuild node_modules/saxes/saxes.js --bundle --platform=browser --format=esm --minify --supported:template-literal=false --outfile=vendor/saxes.mjs`). Licenses: `vendor/Saxes-LICENSE` and `vendor/Xmlchars-LICENSE`.

The entrance cue uses the existing arrow-down icon, a 48px hit target and a 1.8-second fade/downward motion at the bottom center. Scrolling fades the cue out; reduced-motion settings leave a static arrow. Its button continues the existing entrance sequence.

Tests: `node tests/substack-api.mjs`; `JSDOM_MODULE=/path/to/jsdom/lib/api.js node tests/substack.mjs`. The existing local-only `tests/entry-preview.mjs` provides fictitious reader data, with `?feed=empty`, `?feed=error`, `?feed=invalid` and `?feed=retry` cases. Those fixtures are never used by the production reader. `node dev-server.mjs` serves the real public RSS endpoint for local development. The DOMPurify license is in `vendor/DOMPurify-LICENSE`.

## Realm Details

The native page scroll drives a 620svh entrance along one continuous approach from a point Earth into the Korean peninsula and Seoul. All geographic detail uses the same fixed spherical coordinates: a smooth logarithmic camera approach reveals denser regional, metropolitan and local points without switching map scenes or flattening the globe. Neighboring land remains connected; no city boundary, location label or scene caption is rendered. At Seoul, the same points curl into a three-arm spiral, accompanied by nine fine filaments. The arrival spiral stays alive behind the menu and login instead of fading out. The scene stays below 54,000 points on mobile and 100,000 on desktop, without building meshes or enlarged city photos. Natural Earth data is bundled locally; the river and land sampling are artistic simplifications, not a navigation map. The public menu starts appearing at 95.5% scroll and becomes interactive at `#home`. Scrolling up reverses the entire sequence. The arrow remains a keyboard-accessible shortcut. Reduced motion retains a static globe without camera travel or curling; the no-WebGL fallback uses one static Earth illustration. Root overscroll is contained while pinch zoom remains available. Reached menus stay reached on resize. Data sources and rebuild instructions are in [assets/entry-particles.md](assets/entry-particles.md).
Public signup is closed: no signup controls or signup API call remain in the app. Supabase Authentication > Sign In / Providers > Allow new users to sign up is disabled on the hosted project; anonymous sign-in is also disabled. The sole remaining account is the owner's existing email account. Reopening registration requires a deliberate server setting and UI change; hiding a button alone is not access control. Never publish account emails or IDs in an allowlist, and never change owner-only RLS to make this flow work.
The map links to schedule management, workout planning (the existing date-based workout records), and the personal library. Each destination shows only its own view, with a return-to-map link. The old `#projects` URL redirects to `#library`. Calendar connection settings are only available from the calendar. The character control opens the saved avatar/profile editor.
Arrow keys move freely within wide stone-road corridors, stairs, connected bridges, and open plazas. `roads.js` defines separate native-pixel walkable areas for wide and portrait artwork, using Three.js segment projection for collision checks. Movement is 300 screen pixels/second (1.5x the previous speed), normalized diagonally; short swept steps prevent skipping obstacles and permit sliding along edges. Desktop uses nearby Enter; markers are not clickable. On touch-capable devices or compact screens (up to 760 px), dungeon markers become accessible links and a single tap enters directly from anywhere on the map. Optional touch direction controls still use the same movement rules. Resize preserves normalized position; changing map orientation resets to the central plaza. Blur, key release, and logout stop held-key movement.
Public routes are `/`, `#home`, `#substack`, and `#about`, independent of login state or unfinished onboarding. Private realm screens have stable hashes: `#map`, `#profile`, `#avatar`, and `#complete`. Startup waits for the persisted Supabase session before choosing a screen. Refresh and browser navigation restore the requested private screen after validating account prerequisites; signed-out users cannot open one. Public routes never redirect solely because a session changes in another tab. Calendar, workout, and library keep their existing journal hashes. Login drafts survive switching public tabs, but unsaved form inputs and character coordinates are not persisted across reloads.
Entry, auth, profile, character, and map share one persistent Three.js star field and procedural nebula renderer. Camera poses interpolate without resetting at stage boundaries. The dungeon terrain blends into this same space. Visible branding and domain-name copy are intentionally removed. Motion can be disabled; reduced-motion preference is honored.
The avatar is original layered Canvas pixel art with a deterministic Korean/English trait parser. It is **not** a generative AI image service. Supported roles: sage, swordsman, archer, mage, rogue; hair, robe colors, hair length, weapons, hat, and skin tones can change. Unsupported descriptions show an error. All traits include base defaults; free-form details outside the supported vocabulary are not interpreted.

Profiles and avatar specs are saved with Supabase Auth updateUser in the current user's metadata under realm_profile and realm_avatar. These fields are display data, never an authorization source. Journal RLS and existing records/local backup remain unchanged. No additional SQL migration is required for this onboarding. Do not store images/base64, permissions, rewards balances, or other large/privileged data in auth metadata.

Email verification/reset callbacks retain the previously configured https://seungmin.xyz/test.html URL. That route allows password recovery and otherwise requires a complete account profile/avatar. The Cloudflare Pages directory remains the repo root. There are no server API secrets.

## Mobile App

The same site is installable as the PWA "포털" at https://seungmin.xyz. On iPhone, use Safari's Share > Add to Home Screen > Open as Web App. On Android, use Chrome's Install app menu or the install command in the map settings when the browser offers it. This is a home-screen web app, not an App Store/Play Store listing. No additional server or database is required.

The app opens `/` in standalone mode and uses the existing session/onboarding routing. Sign in with the same account to access the same Supabase records; browser and installed-app login sessions may be separate. Touch direction controls, existing return-to-map links, and safe-area spacing work in the app. The default launcher name is "포털"; UI branding remains unchanged.

`sw.js` is network-only for page navigation, with a cached public `offline.html` fallback. It never caches Supabase requests, signed URLs, auth callback responses, uploaded files, or private records, and does not queue offline writes. The original save/error handling is unchanged. Only caches prefixed `realm-offline-` are managed. Activation does not force-reload open pages or discard drafts. Keep app code release URLs versioned as before. Bump the offline cache version when changing the fallback page. `scripts/build-icons.mjs` rebuilds launcher icons from the favicon (set `SHARP_MODULE` if necessary).

Checks: `node tests/pwa.mjs`, `node tests/pwa-sw.mjs`, and existing auth/routing/movement tests. Actual iOS/Android installation still needs a physical-device check. No push notifications, offline editing, or app-store distribution are enabled.

## Personal Library

Apply `supabase/library.sql` once using the existing project's SQL Editor. It creates `library_items` with owner-only RLS and a private `library-files` bucket with a 20 MB file limit. Only HTTP(S) links, PDF, JPEG, PNG, WEBP, GIF, and AVIF are supported. File signatures are checked before upload; bucket MIME restrictions and database checks also apply. Files live in `<user-id>/<item-id>.<type>`, not GitHub, Auth metadata, or browser storage.

The library supports add, search, type filtering, title/notes editing, file opening/downloads, and trash/restore. Trash is reversible and retains its files; permanent deletion and storage-quota management are not implemented. Image thumbnails use short-lived signed URLs. Open files use authenticated downloads and temporary Blob URLs, revoked on close/account changes. API errors keep inputs and failed upload jobs available for retry. Upload jobs reuse their UUID so retries do not create duplicate metadata. If a response fails after uploading, private bytes may remain without a list row; retry the same job to finish. There is no scheduled orphan cleanup.

## Daily Plans And Levels

For a new database, apply `supabase/daily.sql`, then `supabase/daily-midnight.sql` in the same Supabase project. For an existing daily-plan installation, apply only the midnight migration. The base migration adds private plans, tasks, and reward history, owner-only read policies, and authenticated RPCs. The midnight migration preserves existing permissions and records. Clients cannot write the tables directly; each RPC derives the account from `auth.uid()`.

Today's list is a persistent, nonmodal sidebar inside schedule management only. It stays visible after saving or checking tasks and has no close button. Desktop uses a sticky sidebar; narrow layouts place it above the calendar. Map, workout, library, and connection views never open a daily popup. `player-level.js` refreshes only the displayed level on realm pages without mounting any task UI. A list has 1-20 self-reported tasks with 160-character titles. All of today's checks can be undone and the list edited, even after everything is checked. Renaming a checked task resets that check.

Checking every task shows a pending state, not an instant level increase. After KST midnight, a closed day earns one level only if its nonempty list was fully completed before that day's boundary. Settlement runs on the next authenticated state read, including the active page's midnight refresh; offline days settle on the next visit. No background cron or notification subscription is required. Level is 1 plus finalized rewards, not editable Auth metadata. Existing instant-reward rows are retained but contribute only after eligible closed-day settlement. Previous dates cannot be edited through the RPC. Consistent plan locks, server date rechecks, revisions, and a unique user/day reward key prevent late edits or repeated settlement from awarding extra levels. Incomplete or empty days earn nothing.

Daily data lives online, not in browser storage. Focus, reconnect, and the server's next-midnight deadline recheck the active calendar plan; they do not send reminders. An outdated or uncertain write requires a reload before another write. Unsaved input is retained across view switches and errors and requires confirmation before discarding. Account changes clear private UI and ignore late responses. Reminder delivery, reminder preferences, notifications, XP, and calendar synchronization remain out of scope.

## Art

- assets/realm-gate.webp: original image generated with the built-in imagegen tool. Prompt: original high-detail pixel-art Korean fantasy temple valley, central circular jade portal, midnight teal, silver, pale gold, no text/UI/characters. Converted to WebP for delivery.
- assets/dungeon-wide.webp and assets/dungeon-tall.webp: built-in imagegen. Prompt set: original pixel-art East Asian dungeon map with three connected landmarks (jade archive, rose training courtyard, gold workshop), empty central player junction, mossy stone paths and teal water; no text, UI, or characters. Portrait variant repositions the same landmarks into a vertical zigzag for mobile. Converted to WebP.
- assets/dungeon-wide-v2.webp and assets/dungeon-tall-v2.webp: built-in imagegen edits of those maps, adding a weathered stone bridge between the central plaza and roulette approach. Landmark positions, stone texture, lighting, and perspective are preserved; the bridge is painted into the artwork, not a separate vector overlay.
- map-wind.js: a full-map Three.js shader moves only four blossom-canopy regions and a few nearby petals. Roads and buildings remain stationary. It runs at up to 30 fps, pauses outside the map or in hidden tabs, follows the existing motion setting, and falls back to the static artwork when WebGL is unavailable.
- avatar.js: original layered pixel sprite artwork drawn in code; no existing game's sprites are used.
- Three.js r180 and Lucide are vendored with their licenses. Supabase SDK remains vendored.

## Workout Calendar

The workout dungeon has an independent monthly calendar and a selected-day agenda. Weekly goals use Monday through Sunday in Asia/Seoul: running twice, kettlebell swings three times, and push-ups three times. Only completed records dated on or before today count. New future records are planned; completion is reversible. Legacy records without a completion field remain completed, except future dates. Existing workout categories and notes are preserved when editing; legacy `러닝` counts toward `런닝`.

The five default choices are 런닝, 케틀벨 스윙, 푸시업, 스쿼트, 플랭크. Up to 30 additional names (40 characters each) are stored in the signed-in user's Supabase Auth `user_metadata.workout_types`, separate from profile/avatar fields. They are preferences, never authorization data. Saves read the current account first and reject stale account responses; simultaneous edits to this preference list from two devices remain last-write-wins. Anonymous choices stay in a separate local-storage key. Workout records continue to use the existing owner-only `journal_records` RLS; no SQL migration is required.

`node tests/workout.mjs` runs mocked Happy DOM checks for date boundaries, completion undo/failure, legacy records and account-specific choices. `node tests/workout-preview.mjs` serves a local-only fixture at port 4179 for desktop and responsive checks (`tests/workout-responsive.html`). It never accesses production data.

## Testing

Cloudflare's `_headers` requests `no-cache` revalidation. This works on `pages.dev`, but the custom domain currently rewrites static asset responses to `max-age=14400` and removes `no-cache`. Set its Browser Cache TTL to **Respect Existing Headers** in the dashboard when account access is available. Until then, the release query `v=20260924-2` on app CSS/JS URLs and module imports ensures returning visitors fetch the correct release. Bump it consistently across HTML and imports for every code release; headers alone are not sufficient on this domain. No storage clearing or data migration is needed. See [Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) and [Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/).

Node plus Playwright and installed Chrome are needed. Set PLAYWRIGHT_MODULE to the absolute Playwright module path when it is not locally installed.

```sh
node tests/realm.mjs
node tests/online.mjs
node tests/dungeon.mjs
node tests/cache.mjs
node tests/library.mjs
node tests/movement.mjs
node tests/mobile-entry.mjs
node tests/map-wind.mjs
node tests/realm-routing.mjs
node tests/scroll-entry.mjs
node tests/entry-particles.mjs
node tests/daily-db.mjs
node tests/daily-midnight.mjs
node tests/daily-ui.mjs
BROWSER=webkit node tests/realm.mjs
BROWSER=webkit node tests/dungeon.mjs
```

Auth/API calls are mocked; tests do not log into or modify a real account. Runtime animations support prefers-reduced-motion, an explicit persisted motion toggle, visibility pausing, and a no-WebGL fallback.
The library, movement, routing, and daily UI unit tests use Happy DOM. Library and daily schema checks run with PGlite, including two-user RLS isolation and idempotent schema application. Midnight tests substitute a clock only inside the isolated test database to verify undo before midnight, no early rewards, closed-day settlement, legacy reward correction, offline days, and unchanged access controls. UI tests cover the persistent calendar-only surface, hidden other-dungeon states, failed-save drafts, and logout isolation. Set `DOM_MODULE` and `PGLITE_MODULE` to their module paths if needed.

Experience points and automatic calendar-event completion are not implemented. Google Calendar setup is documented in supabase/google-calendar.md.
# Roulette Dungeon

`roulette.html` is an authenticated, standalone dungeon reached from the map. It samples 448 distinct stations from lines 1-9 and Gyeongui-Jungang with equal probability, including branches outside Seoul. Transfers are deduplicated; unrelated same-name stations stay separate. Source snapshot and normalization rules: `data/stations.md`. Core checks: `node tests/roulette.mjs`.

Apply `supabase/roulette.sql` before deploying the selection UI. Spinning is temporary; **선택** records the result in the signed-in user's `roulette_choices` history. The server fixes its KST date and timestamp. Multiple choices on the same day are retained. The `(user_id, station_id)` key prevents repeat selections across devices; idempotent retries return the first date unchanged. Browsers have owner-only read access and a narrow selection RPC, with no update/delete access. This does not grant access to any other journal data. The station name and lines are display snapshots supplied by the client, not independently verified lottery outcomes. History is refreshed before every spin, selected stations are excluded from the remaining equally weighted pool, and a failed history read disables spins. An exhausted pool stays disabled. Choices made simultaneously on another device during an in-flight spin are reconciled on save/refresh. No real account choices are created by tests.

Apply `supabase/roulette-cancellations.sql` after the base roulette migration and before deploying cancellation controls. Cancelling atomically moves a selection to the owner-only `roulette_cancellations` archive and returns the station to the draw pool. The original selection date and server cancellation time remain visible beside active choices (stacked on mobile). Every selection/cancellation cycle has its own history row. The cancellation RPC checks the original selection timestamp, so stale retries cannot cancel a newer selection. Direct client writes remain denied; failed or uncertain requests require refreshing before another spin. Production records are not modified by the migration or tests.

## Schedule Notebook

Click a calendar date or the notebook view control to open the selected day's
spiral notebook. Desktop shows events and daily tasks on facing pages; mobile
uses schedule/task tabs. Arrows, the native date picker, and horizontal touch
swipes change the selected date. Keyboard arrows work only when the book itself
is focused, so text editing keeps its normal keys. The calendar remains available.

`notebook.js` moves the existing agenda and task elements instead of duplicating
their data or save handlers. Drafts survive view/date changes, historical tasks
remain read-only, and Google event create/update forms use the existing API.
Google calendars refresh every five minutes while visible and on return/online,
but never interrupt an open editor. No schema or OAuth permission changes.

Page turns use a local CC0 recording (`assets/audio/LICENSE.md`). The sound toggle
persists per browser, playback only follows user navigation, and playback failure
cannot block navigation. Reduced-motion preferences remove the page animation.
`node tests/notebook.mjs` and `node tests/google-calendar-ui.mjs` cover these paths
with Happy DOM (`DOM_MODULE` may point to its module).

## Dated Tasks

Saved daily tasks already persist in `daily_tasks` by user and KST date. The calendar now reads the visible month's history through existing owner-only RLS and shows completion counts on dates. Selecting a past date swaps the daily panel to a read-only snapshot of that day's titles and completion states; today's editing surface and unsaved draft remain intact when switching dates. Future empty dates are read-only. The existing midnight reward/update procedures are unchanged and still prohibit modifying prior days. No task-history SQL migration or record rewriting is required.

`tests/history.mjs` verifies real PGlite RLS/immutability and the historical task panel. `tests/roulette-history-ui.mjs` checks selection, failures, exhaustion and account isolation. Run with `DOM_MODULE` and `PGLITE_MODULE` if dependencies are not locally installed. `tests/history-preview.mjs` serves a mock-only browser fixture at port 4180; `tests/history-responsive.html` covers 390px and 760px layouts.
