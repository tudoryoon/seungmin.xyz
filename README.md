# Seungmin Personal Realm

Static Cloudflare Pages site. No build step. Serve the repository root over HTTP.

Run `node dev-server.mjs` for a local preview at http://127.0.0.1:4173 (or pass another port).
Keep interface copy literal and minimal. No slogans, lore captions, motivational lines, or personality interpretations.

## Current Flow

Portal entry -> Supabase email login/signup -> profile -> text-driven pixel avatar -> dungeon map.
The map links to schedule management, workout planning (the existing date-based workout records), and the personal library. Each destination shows only its own view, with a return-to-map link. The old `#projects` URL redirects to `#library`. Calendar connection settings are only available from the calendar. The character control opens the saved avatar/profile editor.
Arrow keys move freely within wide stone-road corridors, stairs, connected bridges, and open plazas. `roads.js` defines separate native-pixel walkable areas for wide and portrait artwork, using Three.js segment projection for collision checks. Movement is 300 screen pixels/second (1.5x the previous speed), normalized diagonally; short swept steps prevent skipping obstacles and permit sliding along edges. Desktop uses nearby Enter; markers are not clickable. On touch-capable devices or compact screens (up to 760 px), dungeon markers become accessible links and a single tap enters directly from anywhere on the map. Optional touch direction controls still use the same movement rules. Resize preserves normalized position; changing map orientation resets to the central plaza. Blur, key release, and logout stop held-key movement.
Realm screens have stable hashes: `#map`, `#profile`, `#avatar`, and `#complete`. Startup waits for the persisted Supabase session before choosing a screen. Signed-in users opening the root go to their map (or unfinished onboarding); refresh and browser navigation restore the requested screen after validating account prerequisites. Signed-out users cannot open a protected screen. Calendar, workout, and library keep their existing journal hashes. Unsaved form inputs and character coordinates are not persisted across reloads.
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

## Testing

Cloudflare's `_headers` requests `no-cache` revalidation. This works on `pages.dev`, but the custom domain currently rewrites static asset responses to `max-age=14400` and removes `no-cache`. Set its Browser Cache TTL to **Respect Existing Headers** in the dashboard when account access is available. Until then, the release query `v=20260913-6` on app CSS/JS URLs and module imports ensures returning visitors fetch the correct release. Bump it consistently across HTML and imports for every code release; headers alone are not sufficient on this domain. No storage clearing or data migration is needed. See [Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) and [Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/).

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

`roulette.html` is an authenticated, standalone dungeon reached from the map. It samples 448 distinct stations from lines 1-9 and Gyeongui-Jungang with equal probability, including branches outside Seoul. Transfers are deduplicated; unrelated same-name stations stay separate. Results are temporary, with no Supabase migration or journal changes. Source snapshot and normalization rules: `data/stations.md`. Core checks: `node tests/roulette.mjs`.
