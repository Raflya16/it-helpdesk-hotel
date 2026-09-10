# IT Helpdesk V5.3

## Create Ticket simplification

- `Department` is no longer editable on the Create Ticket form.
- The form displays the department registered on the logged-in user's profile as read-only identity information.
- The database now derives `tickets.department_id` from `profiles.department_id` on insert. A client cannot select or spoof another department when creating a ticket.
- Users without a department assignment cannot create a ticket until an ADMIN assigns their department.

## Optional location fields

- `Property` is optional.
- `Area` is optional.
- `Location Detail` is optional.
- Property and Area remain independent; selecting or omitting one does not constrain the other.
- `area_id` is stored as `NULL` when the user leaves Area empty.

## Database

Run `supabase/upgrade_helpdesk_v5_3.sql` after V5.2. No destructive schema change is made to existing tickets.
