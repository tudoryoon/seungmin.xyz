# Seungmin Personal Realm

Static Cloudflare Pages site. No build step. Serve the repository root over HTTP.

Run `node dev-server.mjs` for a local preview at http://127.0.0.1:4173 (or pass another port).
Keep interface copy literal and minimal. No slogans, lore captions, motivational lines, or personality interpretations.

## Current Flow

Portal entry -> Supabase email login/signup -> profile -> text-driven pixel avatar -> dungeon map.
The map links to schedule management, workout planning (the existing date-based workout records), and a projects placeholder. Projects CRUD is not implemented yet. Map links deep-link to journal views, and the journal's back control returns directly to the map. The character control opens the saved avatar/profile editor.
Entry, auth, profile, character, and map share one persistent Three.js star field and procedural nebula renderer. Camera poses interpolate without resetting at stage boundaries. The dungeon terrain blends into this same space. Visible branding and domain-name copy are intentionally removed. Motion can be disabled; reduced-motion preference is honored.
The avatar is original layered Canvas pixel art with a deterministic Korean/English trait parser. It is **not** a generative AI image service. Supported roles: sage, swordsman, archer, mage, rogue; hair, robe colors, hair length, weapons, hat, and skin tones can change. Unsupported descriptions show an error. All traits include base defaults; free-form details outside the supported vocabulary are not interpreted.

Profiles and avatar specs are saved with Supabase Auth updateUser in the current user's metadata under realm_profile and realm_avatar. These fields are display data, never an authorization source. Journal RLS and existing records/local backup remain unchanged. No additional SQL migration is required for this onboarding. Do not store images/base64, permissions, rewards balances, or other large/privileged data in auth metadata.

Email verification/reset callbacks retain the previously configured https://seungmin.xyz/test.html URL. That route allows password recovery and otherwise requires a complete account profile/avatar. The Cloudflare Pages directory remains the repo root. There are no server API secrets.

## Art

- assets/realm-gate.webp: original image generated with the built-in imagegen tool. Prompt: original high-detail pixel-art Korean fantasy temple valley, central circular jade portal, midnight teal, silver, pale gold, no text/UI/characters. Converted to WebP for delivery.
- assets/dungeon-wide.webp and assets/dungeon-tall.webp: built-in imagegen. Prompt set: original pixel-art East Asian dungeon map with three connected landmarks (jade archive, rose training courtyard, gold workshop), empty central player junction, mossy stone paths and teal water; no text, UI, or characters. Portrait variant repositions the same landmarks into a vertical zigzag for mobile. Converted to WebP.
- avatar.js: original layered pixel sprite artwork drawn in code; no existing game's sprites are used.
- Three.js r180 and Lucide are vendored with their licenses. Supabase SDK remains vendored.

## Testing

Cloudflare's `_headers` explicitly sends `no-cache` to revalidate mutable files on each visit, including when the custom domain's Browser Cache TTL increases `max-age`. App CSS/JS URLs and their module imports use the release query `v=20260912-2` to bypass the previous four-hour browser cache. Keep the query consistent across HTML and imports when changing a release. No storage clearing or data migration is needed. See [Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/).

Node plus Playwright and installed Chrome are needed. Set PLAYWRIGHT_MODULE to the absolute Playwright module path when it is not locally installed.

```sh
node tests/realm.mjs
node tests/online.mjs
node tests/dungeon.mjs
node tests/cache.mjs
BROWSER=webkit node tests/realm.mjs
BROWSER=webkit node tests/dungeon.mjs
```

Auth/API calls are mocked; tests do not log into or modify a real account. Runtime animations support prefers-reduced-motion, an explicit persisted motion toggle, visibility pausing, and a no-WebGL fallback.

Experience points, schedule-completion rewards, and Google Calendar integration are intentionally not implemented yet.
