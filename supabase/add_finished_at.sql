-- Jalankan sekali di Supabase SQL Editor.

alter table public.tickets
add column if not exists finished_at timestamptz null;

-- Backfill ticket lama yang sudah selesai supaya ikut report.
update public.tickets
set finished_at = updated_at
where status in ('RESOLVED', 'CLOSED')
  and finished_at is null;

create index if not exists tickets_finished_at_idx
on public.tickets (finished_at);
