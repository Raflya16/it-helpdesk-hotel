# Hotel IT Helpdesk

React + Vite frontend with Supabase Auth, PostgreSQL/RLS, Storage, notifications, SLA/target-time tracking, audit timeline, responsive UI, reporting, optional Property + global Area location data, and IT-only Internal Notes.

## Existing database

If V5.1 has already been applied, run only:

`supabase/upgrade_helpdesk_v5_2.sql`

If the database is still on V3, run in order:

1. `supabase/upgrade_helpdesk_v5.sql`
2. `supabase/upgrade_helpdesk_v5_1.sql`
3. `supabase/upgrade_helpdesk_v5_2.sql`

See `UPDATE-V5-NOTES.md`, `UPDATE-V5.1-NOTES.md`, and `UPDATE-V5.2-NOTES.md` for details.
