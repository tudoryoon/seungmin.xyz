# Seungmin Personal Realm

Static Cloudflare Pages site. No build step. Serve the repository root over HTTP.

Run `node dev-server.mjs` for a local preview at http://127.0.0.1:4173 (or pass another port).
Keep interface copy literal and minimal. No slogans, lore captions, motivational lines, or personality interpretations.

## Current Flow

Portal entry -> Supabase email login/signup -> profile -> text-driven pixel avatar -> dungeon map.
The map links to schedule management, workout planning (the existing date-based workout records), and the personal library. Each destination shows only its own view, with a return-to-map link. The old `#projects` URL redirects to `#library`. Calendar connection settings are only available from the calendar. The character control opens the saved avatar/profile editor.
Arrow keys move the character along connected stone-road centerlines only. `roads.js` traces separate native-pixel routes for the wide and portrait artwork, using Three.js line curves for constant screen-space travel. At junctions, input chooses the closest matching road direction. Road ends stop movement; only the final approach enables Enter. The forge approach ends where the visible road meets the building, not at the label. Markers are not clickable. Touch controls follow the same roads. Resize preserves segment progress; changing map orientation resets to the central junction. Blur, key release, and logout stop held-key movement. Ambient motion preferences do not disable deliberate keyboard movement.
Entry, auth, profile, character, and map share one persistent Three.js star field and procedural nebula renderer. Camera poses interpolate without resetting at stage boundaries. The dungeon terrain blends into this same space. Visible branding and domain-name copy are intentionally removed. Motion can be disabled; reduced-motion preference is honored.
The avatar is original layered Canvas pixel art with a deterministic Korean/English trait parser. It is **not** a generative AI image service. Supported roles: sage, swordsman, archer, mage, rogue; hair, robe colors, hair length, weapons, hat, and skin tones can change. Unsupported descriptions show an error. All traits include base defaults; free-form details outside the supported vocabulary are not interpreted.

Profiles and avatar specs are saved with Supabase Auth updateUser in the current user's metadata under realm_profile and realm_avatar. These fields are display data, never an authorization source. Journal RLS and existing records/local backup remain unchanged. No additional SQL migration is required for this onboarding. Do not store images/base64, permissions, rewards balances, or other large/privileged data in auth metadata.

Email verification/reset callbacks retain the previously configured https://seungmin.xyz/test.html URL. That route allows password recovery and otherwise requires a complete account profile/avatar. The Cloudflare Pages directory remains the repo root. There are no server API secrets.

## Personal Library

Apply `supabase/library.sql` once using the existing project's SQL Editor. It creates `library_items` with owner-only RLS and a private `library-files` bucket with a 20 MB file limit. Only HTTP(S) links, PDF, JPEG, PNG, WEBP, GIF, and AVIF are supported. File signatures are checked before upload; bucket MIME restrictions and database checks also apply. Files live in `<user-id>/<item-id>.<type>`, not GitHub, Auth metadata, or browser storage.

The library supports add, search, type filtering, title/notes editing, file opening/downloads, and trash/restore. Trash is reversible and retains its files; permanent deletion and storage-quota management are not implemented. Image thumbnails use short-lived signed URLs. Open files use authenticated downloads and temporary Blob URLs, revoked on close/account changes. API errors keep inputs and failed upload jobs available for retry. Upload jobs reuse their UUID so retries do not create duplicate metadata. If a response fails after uploading, private bytes may remain without a list row; retry the same job to finish. There is no scheduled orphan cleanup.

## Art

- assets/realm-gate.webp: original image generated with the built-in imagegen tool. Prompt: original high-detail pixel-art Korean fantasy temple valley, central circular jade portal, midnight teal, silver, pale gold, no text/UI/characters. Converted to WebP for delivery.
- assets/dungeon-wide.webp and assets/dungeon-tall.webp: built-in imagegen. Prompt set: original pixel-art East Asian dungeon map with three connected landmarks (jade archive, rose training courtyard, gold workshop), empty central player junction, mossy stone paths and teal water; no text, UI, or characters. Portrait variant repositions the same landmarks into a vertical zigzag for mobile. Converted to WebP.
- avatar.js: original layered pixel sprite artwork drawn in code; no existing game's sprites are used.
- Three.js r180 and Lucide are vendored with their licenses. Supabase SDK remains vendored.

## Testing

Cloudflare's `_headers` requests `no-cache` revalidation. This works on `pages.dev`, but the custom domain currently rewrites static asset responses to `max-age=14400` and removes `no-cache`. Set its Browser Cache TTL to **Respect Existing Headers** in the dashboard when account access is available. Until then, the release query `v=20260912-4` on app CSS/JS URLs and module imports ensures returning visitors fetch the correct release. Bump it consistently across HTML and imports for every code release; headers alone are not sufficient on this domain. No storage clearing or data migration is needed. See [Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) and [Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/).

Node plus Playwright and installed Chrome are needed. Set PLAYWRIGHT_MODULE to the absolute Playwright module path when it is not locally installed.

```sh
node tests/realm.mjs
node tests/online.mjs
node tests/dungeon.mjs
node tests/cache.mjs
node tests/library.mjs
node tests/movement.mjs
BROWSER=webkit node tests/realm.mjs
BROWSER=webkit node tests/dungeon.mjs
```

Auth/API calls are mocked; tests do not log into or modify a real account. Runtime animations support prefers-reduced-motion, an explicit persisted motion toggle, visibility pausing, and a no-WebGL fallback.
The library and movement unit tests use Happy DOM. Library schema checks run with PGlite, including two-user RLS isolation and idempotent schema application. Set `DOM_MODULE` and `PGLITE_MODULE` to their module paths if needed.

Experience points, schedule-completion rewards, and Google Calendar integration are intentionally not implemented yet.
