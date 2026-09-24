# Private Access and Public Policies

The personal area has a single password field. `realmAccess` in `auth-client.js`
submits the existing owner's email and entered password to Supabase Auth; the
email is a public identifier, not a secret. There is no hardcoded password,
browser-only unlock flag, replacement account, or migration of existing records.
The recovery link uses the existing owner's email and existing recovery screen.
Never put a service-role key or owner password in browser code.

Server-side configuration was checked in Supabase on 2026-09-24:

- Exactly one registered user, the existing owner.
- Allow new users to sign up: off.
- Allow anonymous sign-ins: off.
- Email authentication: on; other providers: off.
- Confirm email: on.

Keep those restrictions in place. A hidden email field or the browser helper is
not an authorization boundary. Existing Supabase sessions, row-level security,
private Storage policies, and the Google Calendar server function remain the
actual data access controls. If additional accounts are ever invited or signup
is reopened, explicitly revisit the owner-only requirement on the server.

`privacy.html` and `terms.html` are public, static, script-free documents. They
must remain accessible without an account. The home page, access page and
calendar connections page link to them. Cloudflare Pages serves their canonical
URLs at `/privacy` and `/terms`. The local static preview uses `.html` URLs.
Policy copy describes the current implementation, not a legal compliance audit.
Review it before opening the service to other users or changing data practices.

Checks (Happy DOM, no live credentials or data changes):

```sh
node tests/private-access.mjs
node tests/realm-routing.mjs
node tests/notebook.mjs
node tests/google-calendar-ui.mjs
```

Set `DOM_MODULE` to the installed Happy DOM module when it is not on the normal
module resolution path. Browser checks should cover the public policy pages,
password-only entrance, a restored private session, and mobile overflow.
