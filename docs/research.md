# Password-Protected Research

## Sector atlas navigation and viewport (2026-09-28)

The atlas keeps all seven layers in a compact, fixed layout and fits them to the
available viewport on entry. This fitted view is the 100% baseline; zoom ranges
from 20% to 300% of that baseline. Use the zoom buttons, mouse wheel, touch pinch, or
keyboard +/− to zoom; drag or use arrow keys to move; **전체 보기** or 0 restores
the overview. The map alone handles these gestures, so the related-article panel
scrolls normally. A drag never activates a sector card. Manual zoom/pan survives
Notion hydration, topic selection, and viewport resize. Hidden panels defer the
initial fit; overview mode follows available space. The SVG connections use
unscaled map coordinates and move with the cards at every zoom level.
CSS layout zoom renders text and SVG at the displayed size instead of scaling a
permanently composited layer. Smaller views retain legible topic labels and
connection strokes, progressively hiding counts and examples before they become
too small to read. The selected topic's full details remain in the side panel.

Each related article has a prominent **Research에서 읽기** link alongside its
Notion source link. The article title opens the same Research reader. Internal
links preserve the evidence section, support modifier/new-tab navigation, and
return to the selected sector through the existing sector-view button. Mobile
shows the zoomable overview above the details with a back-to-map control.

`tests/research-sector-camera.mjs` covers fit, zoom anchors, preserved cameras,
tap/drag distinction, pinch, keyboard control, bounds, hidden views, and cleanup;
`tests/research-sectors.mjs` covers both internal read actions and source links.

## Explicit hashtags (2026-09-28)

Write literal, space-separated tags in Notion prose, for example
`#네오클라우드 #GPU`, `#NBIS`, or `#금리 #ROE #유동성`. A hash immediately
followed by a word declares close topical relevance. Markdown heading markers
(`# Heading`), fenced/inline code, URLs, attachment metadata and HTML attributes
are excluded. Notion-escaped hashes are accepted. Case and formatting separators
are normalized; sector matching uses whole tag aliases, not substring guesses
(`#GPUfoo` does not directly classify a record as GPU).

The sector atlas puts **직접 태그 · 긴밀한 연관** before title/path matches and
ordinary body mentions. Tagged records count as coverage. Exact known company
aliases share an entity; other tags create private, runtime-only topics. Reader
chips and the **직접 태그** filter select only records explicitly bearing that tag.
The usual topic/company filter still includes incidental mentions.

One shared tag is sufficient for a strong record connection. A tagged record
also connects to records whose titles identify that subject/company. Mere body
mentions do not create strong links. Existing parent/source links retain their
type and gain tag evidence; tag connections take precedence over suggestions.
The graph uses a thicker mint line without a directional arrow, the related
panel shows **긴밀한 연관**, and evidence includes the source tag line or target
title. These links remain visible with suggestions disabled and express topical
relevance, not supplier/customer relationships or agreement between conclusions.

Tags remain page-level associations; the source line is retained as evidence,
but no claim is made that a tag scopes all following paragraphs. Removing or
changing a tag rebuilds derived topics, filters and links on the next sync. No
Notion content or credentials are written to this repository. Tests in
`tests/research-tags.mjs` cover parsing, false positives, aliases, filtering,
strong links, provenance, removal, idempotence and sector/reader UI behavior.

## Stable graph viewport (2026-09-28)

Previously every four-page Notion hydration batch destroyed and recreated the
graph, while both the panel renderer and ResizeObserver fitted the viewport
again. The new graph lifecycle keeps one Cytoscape renderer during graph view,
diffs the displayed nodes/edges, and preserves existing node positions, zoom and
pan. Unrelated body changes skip graph mutation. New nodes receive free slots
around the selected record; initial neighbors are distributed evenly. The preset
layout has automatic fitting disabled. Only a new selected record or an explicit
overview button fits the camera; size changes just resize the drawing surface.
The toolbar displays the actual zoom percentage.

Concurrent module loading is coalesced and uses the latest selection. A hidden
mobile panel defers its initial fit until it has nonzero dimensions. Leaving the
graph or locking Research cancels pending work and destroys the renderer.
`tests/research-graph.mjs` uses the shipped Cytoscape engine in headless mode to
verify camera/dragged-position preservation through hydration, graph edits,
suggestion filtering, repeated resize, mobile panels and route events, along
with explicit fit, selection changes, delayed imports and teardown.

## Sector Atlas (2026-09-28)

The bare `#research` route opens the sector atlas. Existing note and graph links
still open the corresponding record. `#research?view=sector&sector=hbm` restores
a sector selection; the Records and Connections buttons retain the original
reader and document relationship graph.

`research-sectors.js` contains a public, versioned study taxonomy: 20 areas over
seven layers, based on the owner's industry map. Process generations, GPU/custom
ASIC, CPU/HBM, packaging, systems, facilities, cloud operators and applications
are separated. The taxonomy and public reference links are shared through the
site's code, so every device receives the same structure after deployment.
Private source text is never included in this module or in fixtures.

`research-sector-view.js` joins the authorized Notion catalog to this taxonomy in
memory after unlocking. Title matches, the immediate parent page and body mentions
have separate labels and evidence. Body mentions are candidate relevance, never a primary-topic decision
or an industry relationship. URLs, image targets, code and embedded attachments
do not contribute. Single-letter tickers match only explicit title patterns.
Empty pages, records with content, mentions and pending hydration have distinct
states. The overview counts areas with nonempty title/parent-matched records, not
research completeness. Search and the gaps filter affect only the atlas; the
record reader retains its filters. New/edited/deleted Notion pages are reconciled
through the existing refresh. Public diagrams include explicitly labeled study
paths and dated official references; a study path is not a verified supply
contract or an investment conclusion. Narrow screens provide a stacked map and
detail panel with navigation back to the map.

This release is an interactive atlas and record browser. It does not yet provide
user-authored node/relation editing, a durable annotation database, or AI calls.
It does not write to Notion, change its permissions, or persist research content
in localStorage. Future relationship editing needs authenticated shared storage
with revision checks; browser-local drafts must not be represented as saved
cross-device data.

Tests: `node tests/research-sectors.mjs` with `DOM_MODULE`, plus the existing
Research, Notion, overlap, access and routing suites. Fixtures cover title
matches vs mentions, false positives from URLs/code, pending and empty records,
edit/delete reconciliation, safe text rendering, deep links, filters, navigation
and an empty catalog.

### Embedded agent follow-up

The next layer can be a server-run research agent with tools to search the
authorized record catalog, read specific pages, inspect the sector map, and
return proposed links with supporting excerpts and source revisions. A proposal
review should show changes before applying them through authenticated storage.
Source text is untrusted evidence, never an instruction granting write access.
Private retrieval must remain scoped to the approved Notion root, even when the
model requests a different page. Notion authoring needs a separate explicit
permission decision because the current connection is read-only.

An embedded agent needs server-side API configuration, authenticated sessions,
usage limits and a run log/cancel mechanism. A chat box alone does not provide
those tools or reuse this desktop chat's session. OpenAI runtime options and
custom functions are described at
https://developers.openai.com/api/docs/guides/agents and
https://developers.openai.com/api/docs/guides/tools. No agent service has been
enabled or billed by this change.

## Live Notion Connection (2026-09-27)

The site uses an internal Notion connection with read-content capability only, no insert/update/comment/agent/user-profile capability. The owner approved sharing only `3b271f4f9d4c80e3ad2cecb7f0db3174` (the overseas study root) and descendants. `NOTION_TOKEN` is a Production secret in Cloudflare, not a build-time browser variable. Source documents are never modified.

`lib/notion-research.js` uses Notion API version `2026-03-11`. A paginated page search is filtered by actual parent ancestry to the approved root. It never follows an arbitrary external URL or imports sibling workspaces. Currently all source records are ordinary nested pages; data-source/database rows are not traversed by this importer. Searches above 1,000 pages fail explicitly instead of silently truncating. The root itself is navigation, not a study record.

Opening Research fetches metadata first, then hydrates four pages per request using the official page-markdown API. The selected record is prioritized. Visible readers check every five minutes; a paused tab resumes on focus. With the site closed there is no scheduled crawl: changes are fetched on the next visit. This is automatic read synchronization, not a continuously running cron or a two-way editor. New, moved, renamed, edited and removed pages are reconciled from the next catalog. Empty pages stay explicitly labeled. Search covers titles immediately and body text as hydration finishes.

`created_time` determines the chronological date, converted to Asia/Seoul (UTC+9); `last_edited_time` is displayed separately. A valid date in the title remains labeled as a title date, never substituted for the API creation timestamp. Copied/imported pages can have creation times different from the original study date. Missing creation metadata remains undated. No manual date input is required.

Source content replaces the previous six summaries in live mode. The graph shows original parent/child relationships and Notion page links as source-based edges. Earlier curated draft connections are retained as explicitly labeled review suggestions, not asserted as newly verified facts about edited text. Two or more shared known topics can also produce dotted suggestions, capped at three additional suggestions per record; this is deterministic alias matching, not an AI semantic inference service. It does not assert causality. New company tickers in page titles are indexed. Marked parses markdown and DOMPurify restricts the result to reading markup, with HTTPS-only links/media. Unsupported or truncated Notion exports carry a visible original-source warning.

Body overlap suggestions (2026-09-28): after both bodies load, `research-overlap.js` compares normalized prose passages, including a report excerpt inside a longer diary. It ignores heading-only matches, code, attachments, URLs and presentation markup. A match requires at least two distinct passages containing at least 25 letters/numbers each and at least 120 matching normalized characters in total. Repeated copies of one passage count once. This is exact normalized text matching, not paraphrase or semantic similarity. Matches display as **본문 중복 · 연결 제안**, with counts, up to three text-only excerpts and links to both bodies. Existing Notion links/hierarchy take priority over duplicate suggestions for the same pair; body overlap takes priority over keyword suggestions and is independent of their three-edge cap. Editing or removing source text rebuilds the suggestions. The existing suggestion toggle hides these edges too. No citation direction is inferred, and no Notion content is written or sent to an external model.

The password gate protects both catalog and hydration responses. The server checks root access for each request. Catalog freshness is at most 30 seconds; body cache freshness is five minutes and keyed by source revision. A page removed from the catalog is never served from its old body cache. Root authorization errors fail closed, including on cache hits. An already displayed copy cannot be recalled immediately; the visible tab learns revocations on its next check. Temporary body failures retain the current view with an explicit delayed-sync status and retry, not a false completion badge.

Cloudflare Cache API stores only AES-GCM encrypted cache entries under token/secret-derived opaque keys. This cache is opportunistic and may be evicted; Notion is the durable source of truth. No plaintext research content or Notion token is committed or put in localStorage/service-worker caches. Server/client responses are private/no-store. Requests are sequential with pacing and one bounded 429 retry. Functions/API usage still follows the services' current quotas; no paid plan was enabled.

Local preview: set `RESEARCH_SECRET_FILE` and `NOTION_TOKEN_FILE` to mode-0600 files outside the repository and run `node dev-server.mjs 4181`. Production needs the matching `RESEARCH_SECRET` and `NOTION_TOKEN` secrets before deployment.

Tests: `JSDOM_MODULE=/path/to/jsdom/lib/api.js node --test tests/notion-research.mjs`, plus the existing Research access/reader/route suites. Tests use synthetic pages and exercise KST date boundaries, root scoping, removed pages, revocation despite cache, encrypted cache storage, rate limits, source date differences, markdown sanitization and progressive client updates. DOMPurify security assertions run against JSDOM, not Happy DOM.

### Read linked pages inside Research

Research's shared password grants read access to the Research copy only. It neither signs the visitor into Notion nor grants permission to edit the source. Notion's **Publish** and **Anyone on the web with link** settings are independent of Research access: both must be disabled to keep the source private. A private parent does not undo separate public settings on a child. Keep authoring access in Notion limited to the owner and explicitly invited accounts; the server integration reads content without sharing its token with visitors.

Notion-hosted image URLs are temporary. Regular five-minute hydration refreshes exports; `research-media.js` additionally catches a failed image, requests one fresh authenticated export and replaces only the matching image URL. Simultaneous failures on a page share the request. The server's `refresh=images` mode permits one authorized page, retains root/deletion checks and coalesces exports for 30 seconds. Signed URLs are never modified with cache-busters. One automatic attempt is followed by a readable error and manual retry, avoiding broken-image icons and retry loops. Lazy loading, responsive width and no-referrer remain enabled. Deleted images and unavailable external hosts cannot be reconstructed. Tests in `research-media.mjs` cover renewal, failure recovery, coalescing, stale DOM disposal and expired-session locking.

`research-links.js` resolves Notion page URLs against the current authorized catalog by page ID, including legacy source URLs, hyphenated IDs, app/public workspace URLs, relative links and database `?p=` links. After sanitization, markdown links, child pages, page mentions, links inside tables and record references use internal Research deep links. Normal clicks show the record, clearing filters that would hide it; modifier clicks open the same internal route. Pending pages use the existing prioritized hydration flow. A Notion block hash opens its containing record; block-level scrolling is not available in the markdown export.

Unknown Notion destinations show an in-reader notice with an explicit **Notion 원문에서 열기** action. They do not redirect, broaden ingestion scope or make an extra Notion request. The footer's **Notion 원문** remains an explicit external link; ordinary non-Notion sources remain external. The page lookup is rebuilt on catalog changes, including deletions/revocations. Background hydration retains an open unavailable-page notice. `tests/research-links.mjs` covers synthetic URL variants, host spoofing, XSS, internal navigation, filter reset, pending-body hydration, route restoration, source opt-in and catalog removal.

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

`DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/research-overlap.mjs`

`DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/research-access.mjs`

`DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/realm-routing.mjs`

The first covers referential integrity, aliases, precise/approximate/unknown dates, combined filters, deep-link serialization, evidence navigation, suggestion visibility, mobile panels and graph failure fallback. The second covers public/legacy routes, entry scroll, private session guards, settings and account navigation.

Access tests cover unauthenticated reads, password verification, cross-origin requests, body limits, signed/tampered/expired cookies, attempt throttling, logout, failed decryption and the client gate. Fixtures contain synthetic text only.
