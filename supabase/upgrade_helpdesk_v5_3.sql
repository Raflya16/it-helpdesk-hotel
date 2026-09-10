-- ============================================================
-- Hotel IT Helpdesk - Upgrade V5.3
-- Reporter department is derived from the logged-in user's profile.
-- Area remains optional and independent from Property.
-- Run AFTER upgrade_helpdesk_v5_2.sql.
-- ============================================================

-- A ticket's department identifies the reporter's registered department.
-- Do not trust a client-supplied department_id on ticket creation.
create or replace function public.set_ticket_reporter_department()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
begin
  select p.department_id
    into v_department_id
  from public.profiles p
  where p.id = new.created_by;

  if v_department_id is null then
    raise exception 'Department akun pelapor belum ditetapkan. Hubungi ADMIN sebelum membuat ticket.';
  end if;

  new.department_id := v_department_id;
  return new;
end;
$$;

revoke all on function public.set_ticket_reporter_department() from public;
grant execute on function public.set_ticket_reporter_department() to authenticated;

drop trigger if exists ticket_set_reporter_department on public.tickets;
create trigger ticket_set_reporter_department
before insert on public.tickets
for each row execute function public.set_ticket_reporter_department();

-- Allow a user to keep seeing the department assigned to their own profile,
-- even if an admin later marks that department inactive.
drop policy if exists "departments read" on public.departments;
create policy "departments read" on public.departments
for select to authenticated
using (
  is_active = true
  or public.current_user_role() = 'ADMIN'
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.department_id = departments.id
  )
);
