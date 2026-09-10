# IT Helpdesk V5 Update Notes

## Added

### 1. Property / Area / Location Detail
- New master data: `hotel_properties` and `hotel_areas`.
- Seeded properties:
  - Four Points by Sheraton Bekasi
  - Fairfield by Marriott Bekasi
- Property-specific areas are tied to each hotel, while common areas can have no Property.
- Create Ticket requires Area; Property can be optional for common areas.
- Existing `tickets.location` is retained as optional **Location Detail** (room number, counter, ballroom section, etc.).
- `Ballroom / Meeting Room` can be stored as a common area without a mandatory Property.
- Admin Ticket advanced filter includes Property and Area.
- Ticket Detail displays Property, Area, and Location Detail.
- Settings has a new **Locations** tab to manage Properties and Areas.

### 2. Internal Note
- IT/Admin can choose **Public Reply** or **Internal Note** in Conversation.
- Internal Note is hidden from EMPLOYEE/reporters at the database RLS layer, not only in the frontend.
- Attachments attached to an Internal Note are also hidden from EMPLOYEE/reporters.
- Internal Note does not count as First Response SLA and does not notify the reporter.
- Audit events for internal notes/attachments are hidden from reporters.

### 3. Notification improvement
- Existing notification flows remain for new ticket, assignment, public replies, status changes, and reopen.
- Internal Note can notify the assigned IT when another IT/Admin adds the note.
- Notification Bell now subscribes to Supabase Realtime for near-instant updates.
- 30-second polling is retained as fallback.

### 4. Stronger Report KPI
Finished-ticket reports now include:
- Ticket DONE
- Average Response Time
- Average Resolution Time
- Response SLA compliance
- Resolution SLA compliance
- Reopen Rate

### 5. Report export
The report page now supports:
- Export PDF
- Export CSV
- Export Excel (`.xls` SpreadsheetML)

CSV/Excel exports contain operational fields including Property, Area, Location Detail, SLA result, response/resolution times, reopen count, and Resolution Note.

## Database migration - REQUIRED

For an existing installation, run:

`supabase/upgrade_helpdesk_v5.sql`

in **Supabase Dashboard > SQL Editor** after the existing V3 migration.

This migration adds new tables/columns, RLS policies, triggers, and the realtime notification publication registration.

## Deployment

After testing locally:

```bash
git add .
git commit -m "Add helpdesk V5 operational features"
git push origin main
```

Vercel should redeploy automatically when connected to the `main` branch.

## Validation

- `npm run typecheck`: PASS
- Production Vite build could not be executed in the Linux workspace because the uploaded ZIP contains Windows-only Rollup optional binaries. Run `npm install` on the target machine before `npm run build`.

## Security note

Do not commit `.env`. The final package intentionally excludes `.env`, `node_modules`, and `dist`.
