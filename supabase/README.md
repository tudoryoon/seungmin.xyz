# Supabase setup

1. In Supabase, open SQL Editor, create a new query, paste `setup.sql`, and Run.
2. In Authentication > URL Configuration set Site URL to `https://seungmin.xyz`.
3. Add `https://seungmin.xyz/test.html` to Redirect URLs.
4. Keep email confirmation enabled. Sign up on the website with your email and a new password, confirm the email, then log in.
5. In the browser where existing records were saved, click the import button after logging in. Local originals are preserved. Repeated imports skip matching IDs.

The GitHub login to the Supabase dashboard is separate from website authentication.
The publishable key in cloud.js is intentionally public. Never put secret or service-role keys into website code.
Google Calendar uses the separate Edge Function described in [google-calendar.md](google-calendar.md). Naver is not connected.

For the personal library, also run `library.sql`. This adds a separate private file bucket and owner-only resource table without altering journal records. Keep the bucket private. The browser uses only the existing publishable key and the signed-in user's session; no admin key is needed. Files in the trash remain stored and can be restored.

The table uses explicit grants and owner-only RLS for every operation. SQL is repeatable without deleting records.
Cloud saves modify individual rows rather than replacing all records. If a request fails, the editor remains open.
Signed-out use continues to store records locally. Online records are cleared from the displayed list on sign-out.
Cross-device changes load on sign-in, page reload, or the refresh button; this version does not subscribe to realtime updates.
