# IT Helpdesk V3.2 — Settings UI Refresh

## Changes

- Replaced native browser `window.confirm()` deletion confirmation with a custom white floating modal and dark backdrop.
- Delete dialog now keeps historical safety checks. Departments/categories that are already referenced by tickets/users are not permanently deleted; the modal explains why and recommends deactivation.
- Redesigned Settings master-data layout for large lists:
  - Departments and Categories use a two-column layout on wide screens.
  - 7 records per page inside each section.
  - Search field per section.
  - Compact rows showing name, description, status, Edit, and Delete.
  - Direct Active/Inactive status toggle from the list.
  - Add/Edit now use a dedicated floating modal instead of permanently visible editable inputs.
  - Compact record counters and pagination controls.
- Mobile/tablet layout remains responsive.
- Sidebar order remains Dashboard → Tickets → Users → Laporan → Settings for ADMIN.

## Database

No new SQL migration is required for V3.2. This update only changes frontend behavior and layout; it uses the existing V3/V3.1 database policies.

## Validation

- `npm run typecheck` passes with no TypeScript errors.
- Production Vite build cannot be completed inside the supplied project copy because its existing `node_modules` is missing the Linux optional Rollup native package. Reinstalling dependencies on the target machine resolves that environment-specific issue.
