# Google Calendar

The schedule grid displays Google events alongside existing journal records. The destination selector controls new-event storage. Google changes go directly to Calendar API; events are not copied to `journal_records`. The site fetches the current month on entry, month navigation, refresh, and returning to a visible tab after a minute. This is pull-based synchronization, not a background webhook service.

All readable calendars in the connected Google account's calendar list are visible by default, including subscriptions and hidden entries (`showHidden=true`). Google Calendar's own `selected` setting does not control this site's visibility. Checkboxes above the month grid and in connections share the same selection. Explicit hidden IDs are stored per browser/Supabase account at `google-calendar-hidden-v2:<user-id>`; the old primary-only allowlist is intentionally reset once. New calendars start visible, and choosing to hide every calendar is preserved. Refresh and entering a calendar view reload the calendar list; toggles never change Google's original calendars or events. A calendar must be subscribed to in the connected Google account and grant at least reader access to expose its event details.

## Deployment

1. Enable Google Calendar API in the Google Cloud project. Configure an external OAuth app and add the owner as a test user while testing.
2. Create a Web application OAuth client with these exact redirect URIs:
   - `https://seungmin.xyz/google-callback.html`
   - `https://seungmin-xyz.pages.dev/google-callback.html`
3. Set server-only Supabase Edge Function Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_ENCRYPTION_KEY` (32 cryptographically random bytes, base64url encoded). Do not commit secret values. Preserve the encryption key when redeploying; rotation requires re-encrypting credentials or reconnecting accounts.
4. Apply `google-calendar.sql` in Supabase SQL Editor. It only adds separate integration tables and a one-time-state RPC. It does not change existing journal, daily or library data.
5. Deploy `functions/google-calendar/index.ts` as `google-calendar` with JWT verification enabled. Built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used only on the server. The handler also validates the session against Supabase Auth before every operation.
6. Publish the static files to Cloudflare Pages. Sign in to the existing website account, open calendar connections, and approve Google access. The Google identity does not replace the Supabase website identity.

Scopes: `openid`, `email`, `calendar.events`, `calendar.calendarlist.readonly`. No Gmail, Drive, contacts, calendar sharing, or calendar-management permission is requested.

## Security and Behavior

- OAuth state is hashed, expires in ten minutes, is bound to the Supabase account and an allowlisted origin, and is atomically consumed. Authorization uses PKCE. Callback query parameters are removed before API requests; Supabase URL-session detection is disabled only on the Google callback page.
- Access and refresh tokens are AES-256-GCM encrypted with the user ID as authenticated additional data. Browser roles cannot read or modify integration tables or invoke the state RPC. Server responses never expose provider credentials. Project administrators still control the backend, database and secrets.
- Tokens and fetched events are never written to browser storage or the service worker cache. Only non-secret calendar visibility preferences are local to each browser/account. Connecting persists across devices through the same Supabase account.
- Calendar permissions are honored. All-day ends are exclusive; multi-day and expanded recurring instances are shown. Editing a recurring instance changes only that occurrence. Patches retain attendees, recurrence and conferencing. Existing attendees receive Google update notifications.
- Event updates require an ETag, so concurrent Google changes are not overwritten. Creation uses a stable random event ID for retries. Failed requests leave the editor open. Calendar deletion, attendee editing, recurrence-rule editing and special event types are handled through the Google Calendar link.
- Disconnect revokes the Google grant and deletes saved credentials, not calendar events. Account deletion cascades stored integration rows. Google access can also be revoked from the Google account security page.
- External apps in Google testing mode generally have seven-day refresh tokens for calendar scopes. Reconnect when prompted. Moving to production and sensitive-scope verification are separate Google configuration steps; do not promise permanent access while testing.

## Verification

`node tests/google-calendar.mjs` covers server authorization, origins, encryption, OAuth replay/account binding, refresh, pagination, date semantics and concurrency guards. `tests/google-calendar-db.mjs` uses PGlite to verify SQL permissions; `tests/google-calendar-ui.mjs` uses Happy DOM to verify the integrated UI. Set `PGLITE_MODULE` / `DOM_MODULE` to dependency paths when needed.

`node tests/google-calendar-preview.mjs` provides a local-only fixture on port 4178 for browser checks. Its events are test data, not a real connection.

Official references: [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar events](https://developers.google.com/calendar/api/v3/reference/events/list), [Supabase secrets](https://supabase.com/docs/guides/functions/secrets).
