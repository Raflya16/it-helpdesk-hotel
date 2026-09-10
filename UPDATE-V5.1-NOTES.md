# IT Helpdesk V5.1 Update Notes

## 1. Location model simplified

Property is no longer mandatory for every ticket.

- `Area` remains required.
- `Property` is optional for common areas.
- `Ballroom / Meeting Room` is treated as one common area used by Four Points and Fairfield.
- Property-specific areas such as `Front Office` and `Front Desk` remain tied to the relevant hotel.
- In Create Ticket, leaving Property empty shows common areas. Selecting a Property shows common areas plus that property's specific areas.
- Existing Location Detail remains optional for room number, counter, ballroom section, etc.

### Settings > Locations

An Area can now be saved with:

- a specific Property, or
- `Tanpa property (area umum)`.

No `Shared` label is introduced in the UI.

## 2. SLA UI simplified

SLA logic is retained in the database because it is useful for operational measurement, overdue detection, and reporting. The day-to-day UI is simplified:

- `SLA` filter is shown as `Target Waktu`.
- `Response Overdue` becomes `Respons terlambat`.
- `Resolution Overdue` becomes `Penyelesaian terlambat`.
- Ticket detail shows `Target Respons` and `Target Selesai`.
- Employee `My Tickets` no longer shows an SLA column.
- Reports show `Respons Sesuai Target` and `Penyelesaian Sesuai Target` percentages.

The underlying SLA policy, due timestamps, and overdue filtering are unchanged.

## Database migration

If V5 has already been run, execute:

`supabase/upgrade_helpdesk_v5_1.sql`

If V5 has not been run yet, execute in this order:

1. `supabase/upgrade_helpdesk_v5.sql`
2. `supabase/upgrade_helpdesk_v5_1.sql`

V5.1 consolidates older duplicate `Ballroom / Meeting Room` rows into one common area while keeping existing ticket references intact.

## Validation

- `npm run typecheck`: PASS
- Production Vite build cannot be completed in this Linux workspace because the uploaded `node_modules` contains the Windows Rollup optional binary. Run a clean `npm install` on the target machine before `npm run build`.
