# Seungmin Personal Realm

Static Cloudflare Pages site. No build step. Serve the repository root over HTTP.

Run `node dev-server.mjs` for a local preview at http://127.0.0.1:4173 (or pass another port).
Keep interface copy literal and minimal. No slogans, lore captions, motivational lines, or personality interpretations.

## Current Flow

Portal entry -> Supabase email login/signup -> profile -> text-driven pixel avatar -> dungeon map.
The map links to schedule management, workout planning (the existing date-based workout records), and the personal library. Each destination shows only its own view, with a return-to-map link. The old `#projects` URL redirects to `#library`. Calendar connection settings are only available from the calendar. The character control opens the saved avatar/profile editor.
Arrow keys move freely within wide stone-road corridors, stairs, connected bridges, and open plazas. `roads.js` defines separate native-pixel walkable areas for wide and portrait artwork, using Three.js segment projection for collision checks. Movement is 300 screen pixels/second (1.5x the previous speed), normalized diagonally; short swept steps prevent skipping obstacles and permit sliding along edges. Only a dungeon approach enables Enter. Markers are not clickable. Touch controls use the same movement rules. Resize preserves normalized position; changing map orientation resets to the central plaza. Blur, key release, and logout stop held-key movement.
Realm screens have stable hashes: `#map`, `#profile`, `#avatar`, and `#complete`. Startup waits for the persisted Supabase session before choosing a screen. Signed-in users opening the root go to their map (or unfinished onboarding); refresh and browser navigation restore the requested screen after validating account prerequisites. Signed-out users cannot open a protected screen. Calendar, workout, and library keep their existing journal hashes. Unsaved form inputs and character coordinates are not persisted across reloads.
Entry, auth, profile, character, and map share one persistent Three.js star field and procedural nebula renderer. Camera poses interpolate without resetting at stage boundaries. The dungeon terrain blends into this same space. Visible branding and domain-name copy are intentionally removed. Motion can be disabled; reduced-motion preference is honored.
The avatar is original layered Canvas pixel art with a deterministic Korean/English trait parser. It is **not** a generative AI image service. Supported roles: sage, swordsman, archer, mage, rogue; hair, robe colors, hair length, weapons, hat, and skin tones can change. Unsupported descriptions show an error. All traits include base defaults; free-form details outside the supported vocabulary are not interpreted.

Profiles and avatar specs are saved with Supabase Auth updateUser in the current user's metadata under realm_profile and realm_avatar. These fields are display data, never an authorization source. Journal RLS and existing records/local backup remain unchanged. No additional SQL migration is required for this onboarding. Do not store images/base64, permissions, rewards balances, or other large/privileged data in auth metadata.

Email verification/reset callbacks retain the previously configured https://seungmin.xyz/test.html URL. That route allows password recovery and otherwise requires a complete account profile/avatar. The Cloudflare Pages directory remains the repo root. There are no server API secrets.

## Personal Library

Apply `supabase/library.sql` once using the existing project's SQL Editor. It creates `library_items` with owner-only RLS and a private `library-files` bucket with a 20 MB file limit. Only HTTP(S) links, PDF, JPEG, PNG, WEBP, GIF, and AVIF are supported. File signatures are checked before upload; bucket MIME restrictions and database checks also apply. Files live in `<user-id>/<item-id>.<type>`, not GitHub, Auth metadata, or browser storage.

The library supports add, search, type filtering, title/notes editing, file opening/downloads, and trash/restore. Trash is reversible and retains its files; permanent deletion and storage-quota management are not implemented. Image thumbnails use short-lived signed URLs. Open files use authenticated downloads and temporary Blob URLs, revoked on close/account changes. API errors keep inputs and failed upload jobs available for retry. Upload jobs reuse their UUID so retries do not create duplicate metadata. If a response fails after uploading, private bytes may remain without a list row; retry the same job to finish. There is no scheduled orphan cleanup.

## Daily Plans And Levels

Apply `supabase/daily.sql` in the same Supabase project before deploying this feature. It adds three private tables (daily plans, tasks, and reward history), owner-only read policies, and two authenticated RPCs. Clients cannot write the tables directly; each RPC derives the account from `auth.uid()`. Existing journal/library schemas and records are not changed.

After completed onboarding, every page load, refresh, sign-in, or restored back/forward visit opens today's list, including saved and completed lists. Dismissing the dialog suppresses automatic reopening only within that currently loaded page; it does not persist in browser storage. The same control is available on the map and inside all three dungeons. A list has 1-20 self-reported tasks with 160-character titles. Before the daily award, users can add/remove/rename tasks or change their checks. Renaming a checked task resets its completion. Removing unfinished tasks does not itself award a level; an explicit finish action is required if the remaining tasks are all checked.

The last completion check awards one level, once per account per Asia/Seoul calendar day. Completed days are locked. Level equals 1 plus the server reward-history count, never a field in editable Auth metadata. Empty lists cannot award. Row locks, optimistic revisions, and a unique user/day reward key protect against concurrent edits and duplicate awards, including retries after a lost response. Previous days remain stored; missed days do not reduce the level.

Daily data lives online, not in browser storage. Old stored prompt-dismissal flags are ignored. Focus, reconnect, and the server's next-midnight deadline recheck the plan; they do not send reminders. An outdated or uncertain write requires a reload before another write. Unsaved input is retained after errors and requires confirmation before discarding. Account changes clear private UI and ignore late responses. Open dialogs pause map movement. Reminder delivery, reminder preferences, notifications, XP, and calendar synchronization remain out of scope.

## Art

- assets/realm-gate.webp: original image generated with the built-in imagegen tool. Prompt: original high-detail pixel-art Korean fantasy temple valley, central circular jade portal, midnight teal, silver, pale gold, no text/UI/characters. Converted to WebP for delivery.
- assets/dungeon-wide.webp and assets/dungeon-tall.webp: built-in imagegen. Prompt set: original pixel-art East Asian dungeon map with three connected landmarks (jade archive, rose training courtyard, gold workshop), empty central player junction, mossy stone paths and teal water; no text, UI, or characters. Portrait variant repositions the same landmarks into a vertical zigzag for mobile. Converted to WebP.
- avatar.js: original layered pixel sprite artwork drawn in code; no existing game's sprites are used.
- Three.js r180 and Lucide are vendored with their licenses. Supabase SDK remains vendored.

## Testing

Cloudflare's `_headers` requests `no-cache` revalidation. This works on `pages.dev`, but the custom domain currently rewrites static asset responses to `max-age=14400` and removes `no-cache`. Set its Browser Cache TTL to **Respect Existing Headers** in the dashboard when account access is available. Until then, the release query `v=20260912-7` on app CSS/JS URLs and module imports ensures returning visitors fetch the correct release. Bump it consistently across HTML and imports for every code release; headers alone are not sufficient on this domain. No storage clearing or data migration is needed. See [Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) and [Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/).

Node plus Playwright and installed Chrome are needed. Set PLAYWRIGHT_MODULE to the absolute Playwright module path when it is not locally installed.

```sh
node tests/realm.mjs
node tests/online.mjs
node tests/dungeon.mjs
node tests/cache.mjs
node tests/library.mjs
node tests/movement.mjs
node tests/realm-routing.mjs
node tests/daily-db.mjs
node tests/daily-ui.mjs
BROWSER=webkit node tests/realm.mjs
BROWSER=webkit node tests/dungeon.mjs
```

Auth/API calls are mocked; tests do not log into or modify a real account. Runtime animations support prefers-reduced-motion, an explicit persisted motion toggle, visibility pausing, and a no-WebGL fallback.
The library, movement, routing, and daily UI unit tests use Happy DOM. Library and daily schema checks run with PGlite, including two-user RLS isolation and idempotent schema application. Daily checks also cover server day boundaries, stale revisions, reward idempotency, direct-write denial, cumulative levels, failed-save draft retention, and logout isolation. Set `DOM_MODULE` and `PGLITE_MODULE` to their module paths if needed.

Experience points, automatic calendar-event completion, and Google Calendar integration are intentionally not implemented yet.
