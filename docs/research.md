# Password-Protected Research

## Live Notion Connection (2026-09-27)

The site uses an internal Notion connection with read-content capability only, no insert/update/comment/agent/user-profile capability. The owner approved sharing only `3b271f4f9d4c80e3ad2cecb7f0db3174` (the overseas study root) and descendants. `NOTION_TOKEN` is a Production secret in Cloudflare, not a build-time browser variable. Source documents are never modified.

`lib/notion-research.js` uses Notion API version `2026-03-11`. A paginated page search is filtered by actual parent ancestry to the approved root. It never follows an arbitrary external URL or imports sibling workspaces. Currently all source records are ordinary nested pages; data-source/database rows are not traversed by this importer. Searches above 1,000 pages fail explicitly instead of silently truncating. The root itself is navigation, not a study record.

Opening Research fetches metadata first, then hydrates four pages per request using the official page-markdown API. The selected record is prioritized. Visible readers check every five minutes; a paused tab resumes on focus. With the site closed there is no scheduled crawl: changes are fetched on the next visit. This is automatic read synchronization, not a continuously running cron or a two-way editor. New, moved, renamed, edited and removed pages are reconciled from the next catalog. Empty pages stay explicitly labeled. Search covers titles immediately and body text as hydration finishes.

`created_time` determines the chronological date, converted to Asia/Seoul (UTC+9); `last_edited_time` is displayed separately. A valid date in the title remains labeled as a title date, never substituted for the API creation timestamp. Copied/imported pages can have creation times different from the original study date. Missing creation metadata remains undated. No manual date input is required.

Source content replaces the previous six summaries in live mode. The graph shows original parent/child relationships and Notion page links as source-based edges. Two or more shared known topics can produce dotted suggestions, capped at three per record; this is deterministic alias matching, not an AI semantic inference service. It does not assert causality. New company tickers in page titles are indexed. Marked parses markdown and DOMPurify restricts the result to reading markup, with HTTPS-only links/media. Unsupported or truncated Notion exports carry a visible original-source warning.

The password gate protects both catalog and hydration responses. The server checks root access for each request. Catalog freshness is at most 30 seconds; body cache freshness is five minutes and keyed by source revision. A page removed from the catalog is never served from its old body cache. Root authorization errors fail closed, including on cache hits. An already displayed copy cannot be recalled immediately; the visible tab learns revocations on its next check. Temporary body failures retain the current view with an explicit delayed-sync status and retry, not a false completion badge.

Cloudflare Cache API stores only AES-GCM encrypted cache entries under token/secret-derived opaque keys. This cache is opportunistic and may be evicted; Notion is the durable source of truth. No plaintext research content or Notion token is committed or put in localStorage/service-worker caches. Server/client responses are private/no-store. Requests are sequential with pacing and one bounded 429 retry. Functions/API usage still follows the services' current quotas; no paid plan was enabled.

Local preview: set `RESEARCH_SECRET_FILE` and `NOTION_TOKEN_FILE` to mode-0600 files outside the repository and run `node dev-server.mjs 4181`. Production needs the matching `RESEARCH_SECRET` and `NOTION_TOKEN` secrets before deployment.

Tests: `JSDOM_MODULE=/path/to/jsdom/lib/api.js node --test tests/notion-research.mjs`, plus the existing Research access/reader/route suites. Tests use synthetic pages and exercise KST date boundaries, root scoping, removed pages, revocation despite cache, encrypted cache storage, rate limits, source date differences, markdown sanitization and progressive client updates. DOMPurify security assertions run against JSDOM, not Happy DOM.

## Original Draft (Historical)

The following describes the earlier six-summary draft. Live synchronization above supersedes its ingestion and date behavior.

On 2026-09-27 the owner requested a Research draft, then added a shared-password requirement before deployment. This release replaces the Substack navigation/reader with Research. It does not change Notion permissions or expose the owner's private calendar, workouts, account metadata or library.

## Current Scope

- Six reviewed summaries: PLTR, FDE, JEV, September 13 investment diary, NVDA earnings, and S/W & platform thesis.
- These are curated paraphrases of actual pages read in the owner's browser, not a complete Notion export. They are explicitly labeled as summaries. Embedded third-party essays and private account identifiers are not republished.
- The snapshot and shared password are AES-256-GCM encrypted in `lib/research-sealed.js`. Only ciphertext is committed. The random 256-bit `RESEARCH_SECRET` is stored in Cloudflare Production secrets, never in browser code or Git. No database migration or paid model call is needed.
- Notion links may still require the original page's access permissions. Research does not make the source workspace public.
- No continuous Notion synchronization has been configured. The footer states this and shows the capture date; the date must not be advanced without reviewing refreshed source content.

## Engine

`research-core.js` validates and indexes records, entities/aliases and typed relations. IDs are stable and independent of titles. Relations must have existing endpoints, evidence sections in both endpoints, a reason, and an explicit provenance status.

`editorial` means a curated connection grounded in the source records, not a verified financial or technical fact. `suggested` means an inferred cross-record connection. The UI distinguishes these and permits hiding suggestions. Similarity never automatically becomes causality. The draft relations are curated, not generated by an unattended AI service.

Dates preserve their meaning and precision: study/title date, event date, approximate dates and undated records are separate. The NVDA title/body fiscal-period discrepancy remains visible. Empty Notion placeholders are excluded rather than presented as completed research.

Search indexes titles, summaries, questions, sections, source paths and aliases. `#research?note=pltr&view=graph` restores selection and view; query/date/topic filters and evidence section links are also addressable. Old `#substack` bookmarks redirect to `#research`. Existing authentication guards remain unchanged.

The default reader has a chronological list, article and evidence sidebar. Mobile uses separate list/article/related panels. Cytoscape.js 3.34.3 (MIT, vendored from the official npm package) powers an on-demand one-hop graph with node navigation, clickable evidence edges, zoom and touch support. Equivalent links remain accessible without the graph. Leaving Research destroys the graph instance.

## Access

`/api/research` verifies the shared password on the server and issues an eight-hour HMAC-signed HttpOnly, Secure, SameSite=Strict cookie. The GET endpoint returns data only after verifying the signature and expiry. A lock button expires the cookie and removes the reader from the page. The owner-selected password is intentionally weak; this is not strong identity authentication or a substitute for private account access.

The endpoint rejects cross-origin mutations, bounds request size, and sends private/no-store responses. Five failed attempts per IP in 15 minutes trigger a best-effort per-isolate throttle, not a durable/global rate limit. Client code stores neither passwords nor record data in localStorage. Missing or invalid server secrets fail closed. Existing Supabase account permissions are unchanged.

To replace the reviewed snapshot, keep the plaintext JSON outside the repo and run `scripts/seal-research.mjs` with `RESEARCH_PASSWORD` in the process environment. The script writes a new ciphertext module and a separate mode-0600 secret file. Set the matching Cloudflare Production secret before deploying. Do not commit the secret or input file; rotating it invalidates prior sessions. Production and Preview secrets are independent; unconfigured previews remain locked.

## Next: Source Ingestion

Use a server-side, read-only Notion integration scoped to the selected root. Never put a Notion token in GitHub, browser JavaScript or localStorage. Authoring stays in Notion.

Store page and block IDs, source hierarchy, capture timestamps, content revisions and access status. Read parent bodies as well as child pages. Update by ID, retain provenance, flag changed evidence for review, and process archived/deleted or permission-revoked records distinctly from temporary API errors. Do not use a last-good cache to override an explicit removal decision.

Only after that connection is established should webhook/periodic refresh be enabled. Keep Research records and private journal tables separate. New automatic inference must continue to label suggestions and include the exact supporting blocks.

## Tests

`DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/research.mjs`

`DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/research-access.mjs`

`DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/realm-routing.mjs`

The first covers referential integrity, aliases, precise/approximate/unknown dates, combined filters, deep-link serialization, evidence navigation, suggestion visibility, mobile panels and graph failure fallback. The second covers public/legacy routes, entry scroll, private session guards, settings and account navigation.

Access tests cover unauthenticated reads, password verification, cross-origin requests, body limits, signed/tampered/expired cookies, attempt throttling, logout, failed decryption and the client gate. Fixtures contain synthetic text only.
