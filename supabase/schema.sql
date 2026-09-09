-- Hotel IT Helpdesk - Supabase schema
-- Run this entire file in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- ---------- Master data ----------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Users ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'EMPLOYEE' check (role in ('EMPLOYEE','IT','ADMIN')),
  department_id uuid references public.departments(id) on delete set null,
  position text,
  employee_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Separate daily counter prevents duplicate ticket numbers under concurrent inserts.
create table if not exists public.ticket_counters (
  ticket_date date primary key,
  last_value integer not null default 0
);

-- ---------- Tickets ----------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  title text not null check (char_length(title) >= 5),
  description text not null check (char_length(description) >= 10),
  category_id uuid not null references public.ticket_categories(id),
  department_id uuid not null references public.departments(id),
  location text,
  device_name text,
  priority text not null check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN','ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED')),
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create index if not exists tickets_created_by_idx on public.tickets(created_by);
create index if not exists tickets_assigned_to_idx on public.tickets(assigned_to);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_created_at_idx on public.tickets(created_at desc);

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  comment text not null check (char_length(trim(comment)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  file_type text not null,
  file_size bigint not null check (file_size >= 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_value text,
  new_value text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_comments_ticket_idx on public.ticket_comments(ticket_id, created_at);
create index if not exists ticket_attachments_ticket_idx on public.ticket_attachments(ticket_id, created_at);
create index if not exists ticket_history_ticket_idx on public.ticket_history(ticket_id, created_at);

-- ---------- Helper functions ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_it()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('IT','ADMIN') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (t.created_by = auth.uid() or public.is_it())
  );
$$;

create or replace function public.can_access_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
begin
  begin
    v_ticket_id := split_part(p_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;
  return public.can_access_ticket(v_ticket_id);
end;
$$;

create or replace function public.assign_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_next integer;
begin
  insert into public.ticket_counters(ticket_date, last_value)
  values (v_date, 1)
  on conflict (ticket_date)
  do update set last_value = public.ticket_counters.last_value + 1
  returning last_value into v_next;

  new.ticket_number := 'TKT-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email,'employee'), '@', 1)),
    new.email,
    'EMPLOYEE'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.log_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_history(ticket_id, user_id, action, new_value, description)
  values (new.id, new.created_by, 'TICKET_CREATED', new.status, 'Ticket created');
  return new;
end;
$$;

create or replace function public.log_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description)
    values (new.id, auth.uid(), 'STATUS_CHANGED', old.status, new.status, 'Ticket status changed');
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description)
    values (new.id, auth.uid(), 'ASSIGNEE_CHANGED', old.assigned_to::text, new.assigned_to::text, 'Ticket assignee changed');
  end if;

  if old.priority is distinct from new.priority then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description)
    values (new.id, auth.uid(), 'PRIORITY_CHANGED', old.priority, new.priority, 'Ticket priority changed');
  end if;

  if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
    new.resolved_at = now();
  end if;

  if new.status = 'CLOSED' and old.status is distinct from 'CLOSED' then
    new.closed_at = now();
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_history(ticket_id,user_id,action,description)
  values (new.ticket_id, new.user_id, 'COMMENT_ADDED', 'Comment added');
  return new;
end;
$$;

create or replace function public.log_attachment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_history(ticket_id,user_id,action,new_value,description)
  values (new.ticket_id, new.uploaded_by, 'ATTACHMENT_ADDED', new.file_name, 'Attachment uploaded');
  return new;
end;
$$;

-- ---------- Triggers ----------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists departments_updated_at on public.departments;
create trigger departments_updated_at before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists categories_updated_at on public.ticket_categories;
create trigger categories_updated_at before update on public.ticket_categories
for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists tickets_number on public.tickets;
create trigger tickets_number before insert on public.tickets
for each row execute function public.assign_ticket_number();

drop trigger if exists ticket_created_history on public.tickets;
create trigger ticket_created_history after insert on public.tickets
for each row execute function public.log_ticket_created();

drop trigger if exists ticket_update_history on public.tickets;
create trigger ticket_update_history before update on public.tickets
for each row execute function public.log_ticket_update();

drop trigger if exists comment_history on public.ticket_comments;
create trigger comment_history after insert on public.ticket_comments
for each row execute function public.log_comment_created();

drop trigger if exists attachment_history on public.ticket_attachments;
create trigger attachment_history after insert on public.ticket_attachments
for each row execute function public.log_attachment_created();

-- ---------- RLS ----------
alter table public.departments enable row level security;
alter table public.ticket_categories enable row level security;
alter table public.profiles enable row level security;
alter table public.ticket_counters enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_history enable row level security;

-- Drop policies to make reruns predictable.
drop policy if exists "departments read" on public.departments;
drop policy if exists "departments admin write" on public.departments;
drop policy if exists "categories read" on public.ticket_categories;
drop policy if exists "categories admin write" on public.ticket_categories;
drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "tickets read" on public.tickets;
drop policy if exists "tickets create" on public.tickets;
drop policy if exists "tickets it update" on public.tickets;
drop policy if exists "comments read" on public.ticket_comments;
drop policy if exists "comments create" on public.ticket_comments;
drop policy if exists "attachments read" on public.ticket_attachments;
drop policy if exists "attachments create" on public.ticket_attachments;
drop policy if exists "history read" on public.ticket_history;

create policy "departments read" on public.departments
for select to authenticated using (is_active = true or public.current_user_role() = 'ADMIN');
create policy "departments admin write" on public.departments
for all to authenticated using (public.current_user_role() = 'ADMIN') with check (public.current_user_role() = 'ADMIN');

create policy "categories read" on public.ticket_categories
for select to authenticated using (is_active = true or public.current_user_role() = 'ADMIN');
create policy "categories admin write" on public.ticket_categories
for all to authenticated using (public.current_user_role() = 'ADMIN') with check (public.current_user_role() = 'ADMIN');

create policy "profiles read" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_it());
create policy "profiles own update" on public.profiles
for update to authenticated using (id = auth.uid())
with check (id = auth.uid() and role = public.current_user_role());

create policy "tickets read" on public.tickets
for select to authenticated using (created_by = auth.uid() or public.is_it());
create policy "tickets create" on public.tickets
for insert to authenticated with check (created_by = auth.uid());
create policy "tickets it update" on public.tickets
for update to authenticated using (public.is_it()) with check (public.is_it());

create policy "comments read" on public.ticket_comments
for select to authenticated using (public.can_access_ticket(ticket_id));
create policy "comments create" on public.ticket_comments
for insert to authenticated with check (user_id = auth.uid() and public.can_access_ticket(ticket_id));

create policy "attachments read" on public.ticket_attachments
for select to authenticated using (public.can_access_ticket(ticket_id));
create policy "attachments create" on public.ticket_attachments
for insert to authenticated with check (uploaded_by = auth.uid() and public.can_access_ticket(ticket_id));

create policy "history read" on public.ticket_history
for select to authenticated using (public.can_access_ticket(ticket_id));

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ticket files upload" on storage.objects;
drop policy if exists "ticket files read" on storage.objects;
drop policy if exists "ticket files delete own" on storage.objects;

create policy "ticket files upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_access_storage_object(name)
);

create policy "ticket files read" on storage.objects
for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and public.can_access_storage_object(name)
);

create policy "ticket files delete own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'ticket-attachments'
  and owner_id = auth.uid()::text
);

-- ---------- Seed data ----------
insert into public.departments(name) values
('Front Office'),('Housekeeping'),('Food & Beverage'),('Restaurant'),('Kitchen'),
('Finance'),('Accounting'),('Human Resources'),('Sales'),('Marketing'),
('Engineering'),('Security'),('IT'),('Management'),('Reservation'),('Purchasing'),('Other')
on conflict (name) do nothing;

insert into public.ticket_categories(name) values
('Computer / PC'),('Laptop'),('Printer'),('Network'),('WiFi'),('Internet'),
('Access Point'),('Microsoft Office'),('Email'),('PMS / Opera'),('POS'),
('Telephone / PABX'),('CCTV'),('User Account'),('Hardware'),('Software'),('Server'),('Other')
on conflict (name) do nothing;

-- After creating an Auth user in Supabase Dashboard, promote IT users with:
-- Admin accounts (create them first in Supabase Authentication > Users):
-- update public.profiles set name = 'admin1', role = 'ADMIN' where email = 'admin1@marriot.com';
-- update public.profiles set name = 'admin2', role = 'ADMIN' where email = 'admin2@marriot.com';
-- update public.profiles set role = 'IT' where email = 'it@hotel.com';


-- =====================================================
-- OPERATIONAL UPGRADE V2 (notifications, SLA, profile management)
-- Kept in schema.sql so fresh installations get the same features.
-- Existing installations can run supabase/upgrade_helpdesk_v2.sql instead.
-- =====================================================

-- =====================================================
-- Hotel IT Helpdesk - Operational Upgrade v2
-- Run once in Supabase Dashboard > SQL Editor.
-- Adds notifications, SLA timestamps and safer admin profile management.
-- =====================================================

create extension if not exists pgcrypto;

-- ---------- SLA fields ----------
alter table public.tickets
  add column if not exists first_response_at timestamptz null;

alter table public.tickets
  add column if not exists finished_at timestamptz null;

create index if not exists tickets_first_response_at_idx
  on public.tickets(first_response_at);

create index if not exists tickets_finished_at_idx
  on public.tickets(finished_at);

-- Backfill historical DONE tickets.
update public.tickets
set finished_at = coalesce(finished_at, closed_at, resolved_at, updated_at)
where status in ('RESOLVED', 'CLOSED')
  and finished_at is null;

-- Approximate historical first response from the earliest IT/Admin activity.
update public.tickets as t
set first_response_at = history.first_response_at
from (
  select
    h.ticket_id,
    min(h.created_at) as first_response_at
  from public.ticket_history h
  join public.profiles p on p.id = h.user_id
  where p.role in ('IT','ADMIN')
    and h.action in (
      'COMMENT_ADDED',
      'STATUS_CHANGED',
      'ASSIGNEE_CHANGED',
      'PRIORITY_CHANGED'
    )
  group by h.ticket_id
) as history
where t.id = history.ticket_id
  and t.first_response_at is null;

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;

drop policy if exists "notifications read own" on public.notifications;
drop policy if exists "notifications update own" on public.notifications;

create policy "notifications read own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "notifications update own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------- Profile policies ----------
-- Employees may read themselves and active IT/Admin display names.
-- IT/Admin can read all profiles.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_it()
  or (role in ('IT','ADMIN') and is_active = true)
);

-- Admin may manage existing profiles. Auth-account creation/reset remains
-- in Supabase Authentication so no service-role key is exposed in the browser.
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

-- ---------- Notification helper ----------
create or replace function public.create_helpdesk_notification(
  p_user_id uuid,
  p_ticket_id uuid,
  p_type text,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications(
    user_id,
    ticket_id,
    type,
    title,
    message
  )
  values (
    p_user_id,
    p_ticket_id,
    p_type,
    p_title,
    p_message
  );
end;
$$;

-- ---------- Ticket insert notification ----------
create or replace function public.notify_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_name text;
  v_recipient record;
begin
  select coalesce(name, 'Staff')
  into v_reporter_name
  from public.profiles
  where id = new.created_by;

  for v_recipient in
    select id
    from public.profiles
    where role in ('IT','ADMIN')
      and is_active = true
      and id <> new.created_by
  loop
    perform public.create_helpdesk_notification(
      v_recipient.id,
      new.id,
      'NEW_TICKET',
      'Ticket baru',
      coalesce(v_reporter_name, 'Staff') || ' membuat ' || new.ticket_number
    );
  end loop;

  return new;
end;
$$;

-- ---------- Ticket update SLA + notifications ----------
create or replace function public.log_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  select coalesce(name, 'IT')
  into v_actor_name
  from public.profiles
  where id = v_actor;

  if old.status is distinct from new.status then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description)
    values (new.id, v_actor, 'STATUS_CHANGED', old.status, new.status, 'Ticket status changed');

    if new.created_by is distinct from v_actor then
      perform public.create_helpdesk_notification(
        new.created_by,
        new.id,
        'STATUS_CHANGED',
        'Status ticket berubah',
        coalesce(v_actor_name, 'IT') || ' memperbarui status ' || new.ticket_number
      );
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description)
    values (new.id, v_actor, 'ASSIGNEE_CHANGED', old.assigned_to::text, new.assigned_to::text, 'Ticket assignee changed');

    if new.assigned_to is not null and new.assigned_to is distinct from v_actor then
      perform public.create_helpdesk_notification(
        new.assigned_to,
        new.id,
        'ASSIGNED',
        'Ticket ditugaskan kepada Anda',
        new.ticket_number || ' membutuhkan penanganan'
      );
    end if;
  end if;

  if old.priority is distinct from new.priority then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description)
    values (new.id, v_actor, 'PRIORITY_CHANGED', old.priority, new.priority, 'Ticket priority changed');
  end if;

  -- First response is the first time IT starts handling the ticket.
  if new.first_response_at is null
     and old.status in ('OPEN','ASSIGNED')
     and new.status in ('IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') then
    new.first_response_at = now();
  end if;

  if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
    new.resolved_at = coalesce(new.resolved_at, now());
  end if;

  if new.status = 'CLOSED' and old.status is distinct from 'CLOSED' then
    new.closed_at = coalesce(new.closed_at, now());
  end if;

  if new.status in ('RESOLVED','CLOSED')
     and old.status not in ('RESOLVED','CLOSED') then
    new.finished_at = coalesce(new.finished_at, now());
  end if;

  if new.status not in ('RESOLVED','CLOSED')
     and old.status in ('RESOLVED','CLOSED') then
    new.finished_at = null;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Comment history, SLA response and notification ----------
create or replace function public.log_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_author_role text;
  v_author_name text;
  v_recipient record;
begin
  insert into public.ticket_history(ticket_id,user_id,action,description)
  values (new.ticket_id, new.user_id, 'COMMENT_ADDED', 'Comment added');

  select * into v_ticket
  from public.tickets
  where id = new.ticket_id;

  select role, coalesce(name, 'User')
  into v_author_role, v_author_name
  from public.profiles
  where id = new.user_id;

  if v_author_role in ('IT','ADMIN') then
    update public.tickets
    set first_response_at = coalesce(first_response_at, now())
    where id = new.ticket_id;

    if v_ticket.created_by is distinct from new.user_id then
      perform public.create_helpdesk_notification(
        v_ticket.created_by,
        new.ticket_id,
        'COMMENT_ADDED',
        'Balasan baru dari IT',
        coalesce(v_author_name, 'IT') || ' membalas ' || v_ticket.ticket_number
      );
    end if;
  else
    -- Prefer the assigned IT. If unassigned, alert all active IT/Admin.
    if v_ticket.assigned_to is not null then
      if v_ticket.assigned_to is distinct from new.user_id then
        perform public.create_helpdesk_notification(
          v_ticket.assigned_to,
          new.ticket_id,
          'COMMENT_ADDED',
          'Balasan baru dari staff',
          coalesce(v_author_name, 'Staff') || ' membalas ' || v_ticket.ticket_number
        );
      end if;
    else
      for v_recipient in
        select id
        from public.profiles
        where role in ('IT','ADMIN')
          and is_active = true
          and id <> new.user_id
      loop
        perform public.create_helpdesk_notification(
          v_recipient.id,
          new.ticket_id,
          'COMMENT_ADDED',
          'Balasan baru dari staff',
          coalesce(v_author_name, 'Staff') || ' membalas ' || v_ticket.ticket_number
        );
      end loop;
    end if;
  end if;

  return new;
end;
$$;

-- Recreate triggers so this migration is safe to rerun.
drop trigger if exists helpdesk_ticket_created_notification on public.tickets;
create trigger helpdesk_ticket_created_notification
after insert on public.tickets
for each row execute function public.notify_ticket_created();

drop trigger if exists ticket_update_history on public.tickets;
create trigger ticket_update_history
before update on public.tickets
for each row execute function public.log_ticket_update();

drop trigger if exists comment_history on public.ticket_comments;
create trigger comment_history
after insert on public.ticket_comments
for each row execute function public.log_comment_created();


-- =====================================================
-- OPERATIONAL UPGRADE V3
-- Resolution Note, Reopen, conversation attachments, SLA overdue,
-- audit timeline and RLS hardening.
-- For existing installations run supabase/upgrade_helpdesk_v3.sql.
-- =====================================================
-- =====================================================
-- Hotel IT Helpdesk - Operational Upgrade v3
-- Resolution Note, Reopen, conversation attachments,
-- configurable SLA due dates, audit trail and RLS hardening.
-- Safe to rerun after schema.sql / upgrade_helpdesk_v2.sql.
-- =====================================================

create extension if not exists pgcrypto;

-- ---------- Configurable SLA policy ----------
create table if not exists public.sla_policies (
  priority text primary key check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  response_minutes integer not null check (response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  updated_at timestamptz not null default now()
);

insert into public.sla_policies(priority, response_minutes, resolution_minutes)
values
  ('LOW', 240, 1440),
  ('MEDIUM', 120, 480),
  ('HIGH', 30, 240),
  ('CRITICAL', 15, 120)
on conflict (priority) do nothing;

-- ---------- Ticket operational fields ----------
alter table public.tickets
  add column if not exists resolution_note text null;

alter table public.tickets
  add column if not exists reopened_at timestamptz null;

alter table public.tickets
  add column if not exists reopened_by uuid null references public.profiles(id) on delete set null;

alter table public.tickets
  add column if not exists reopen_count integer not null default 0;

alter table public.tickets
  add column if not exists sla_response_due_at timestamptz null;

alter table public.tickets
  add column if not exists sla_resolution_due_at timestamptz null;

create index if not exists tickets_sla_response_due_idx
  on public.tickets(sla_response_due_at)
  where first_response_at is null;

create index if not exists tickets_sla_resolution_due_idx
  on public.tickets(sla_resolution_due_at)
  where finished_at is null;

-- ---------- Conversation attachment relation ----------
alter table public.ticket_attachments
  add column if not exists comment_id uuid null references public.ticket_comments(id) on delete cascade;

create index if not exists ticket_attachments_comment_idx
  on public.ticket_attachments(comment_id, created_at);

-- Structured audit metadata for future extensions.
alter table public.ticket_history
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ---------- SLA calculator ----------
create or replace function public.apply_ticket_sla()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_response_minutes integer;
  v_resolution_minutes integer;
  v_base timestamptz;
begin
  select response_minutes, resolution_minutes
  into v_response_minutes, v_resolution_minutes
  from public.sla_policies
  where priority = new.priority;

  v_response_minutes := coalesce(v_response_minutes, 120);
  v_resolution_minutes := coalesce(v_resolution_minutes, 480);

  if tg_op = 'INSERT' then
    v_base := coalesce(new.created_at, now());
  elsif old.reopened_at is distinct from new.reopened_at and new.reopened_at is not null then
    v_base := new.reopened_at;
  elsif old.priority is distinct from new.priority then
    v_base := coalesce(new.reopened_at, new.created_at, now());
  else
    return new;
  end if;

  new.sla_response_due_at := v_base + make_interval(mins => v_response_minutes);
  new.sla_resolution_due_at := v_base + make_interval(mins => v_resolution_minutes);
  return new;
end;
$$;

drop trigger if exists ticket_apply_sla on public.tickets;
create trigger ticket_apply_sla
before insert or update of priority, reopened_at on public.tickets
for each row execute function public.apply_ticket_sla();

-- Backfill SLA due dates for existing tickets.
update public.tickets t
set
  sla_response_due_at = coalesce(t.reopened_at, t.created_at) + make_interval(mins => p.response_minutes),
  sla_resolution_due_at = coalesce(t.reopened_at, t.created_at) + make_interval(mins => p.resolution_minutes)
from public.sla_policies p
where p.priority = t.priority
  and (t.sla_response_due_at is null or t.sla_resolution_due_at is null);

-- ---------- Stronger ticket audit + resolution rules ----------
create or replace function public.log_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  select coalesce(name, 'IT')
  into v_actor_name
  from public.profiles
  where id = v_actor;

  if old.status in ('RESOLVED','CLOSED')
     and new.status not in ('RESOLVED','CLOSED')
     and new.reopened_at is not distinct from old.reopened_at then
    raise exception 'Ticket selesai harus dibuka kembali melalui Reopen Ticket.';
  end if;

  if old.status not in ('RESOLVED','CLOSED')
     and new.status in ('RESOLVED','CLOSED')
     and char_length(trim(coalesce(new.resolution_note, ''))) < 5 then
    raise exception 'Resolution Note minimal 5 karakter sebelum ticket diselesaikan.';
  end if;

  if old.status is distinct from new.status then
    insert into public.ticket_history(
      ticket_id,user_id,action,old_value,new_value,description,metadata
    ) values (
      new.id,v_actor,'STATUS_CHANGED',old.status,new.status,'Ticket status changed',
      jsonb_build_object('source','ticket_update')
    );

    if new.created_by is distinct from v_actor then
      perform public.create_helpdesk_notification(
        new.created_by,
        new.id,
        'STATUS_CHANGED',
        'Status ticket berubah',
        coalesce(v_actor_name, 'IT') || ' memperbarui status ' || new.ticket_number
      );
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.ticket_history(
      ticket_id,user_id,action,old_value,new_value,description,metadata
    ) values (
      new.id,v_actor,'ASSIGNEE_CHANGED',old.assigned_to::text,new.assigned_to::text,
      'Ticket assignee changed','{}'::jsonb
    );

    if new.assigned_to is not null and new.assigned_to is distinct from v_actor then
      perform public.create_helpdesk_notification(
        new.assigned_to,
        new.id,
        'ASSIGNED',
        'Ticket ditugaskan kepada Anda',
        new.ticket_number || ' membutuhkan penanganan'
      );
    end if;
  end if;

  if old.priority is distinct from new.priority then
    insert into public.ticket_history(
      ticket_id,user_id,action,old_value,new_value,description,metadata
    ) values (
      new.id,v_actor,'PRIORITY_CHANGED',old.priority,new.priority,
      'Ticket priority changed','{}'::jsonb
    );
  end if;

  if old.category_id is distinct from new.category_id then
    insert into public.ticket_history(
      ticket_id,user_id,action,old_value,new_value,description,metadata
    ) values (
      new.id,v_actor,'CATEGORY_CHANGED',old.category_id::text,new.category_id::text,
      'Ticket category changed','{}'::jsonb
    );
  end if;

  if old.department_id is distinct from new.department_id then
    insert into public.ticket_history(
      ticket_id,user_id,action,old_value,new_value,description,metadata
    ) values (
      new.id,v_actor,'DEPARTMENT_CHANGED',old.department_id::text,new.department_id::text,
      'Ticket department changed','{}'::jsonb
    );
  end if;

  if old.resolution_note is distinct from new.resolution_note then
    insert into public.ticket_history(
      ticket_id,user_id,action,old_value,new_value,description,metadata
    ) values (
      new.id,v_actor,'RESOLUTION_NOTE_UPDATED',null,null,
      'Resolution Note updated',
      jsonb_build_object('has_note', new.resolution_note is not null)
    );
  end if;

  if new.first_response_at is null
     and old.status in ('OPEN','ASSIGNED')
     and new.status in ('IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') then
    new.first_response_at = now();
  end if;

  if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' then
    new.resolved_at = coalesce(new.resolved_at, now());
  end if;

  if new.status = 'CLOSED' and old.status is distinct from 'CLOSED' then
    new.closed_at = coalesce(new.closed_at, now());
  end if;

  if new.status in ('RESOLVED','CLOSED')
     and old.status not in ('RESOLVED','CLOSED') then
    new.finished_at = coalesce(new.finished_at, now());
  end if;

  if new.status not in ('RESOLVED','CLOSED')
     and old.status in ('RESOLVED','CLOSED') then
    new.finished_at = null;
    new.resolved_at = null;
    new.closed_at = null;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ticket_update_history on public.tickets;
create trigger ticket_update_history
before update on public.tickets
for each row execute function public.log_ticket_update();

-- ---------- Reopen RPC ----------
create or replace function public.reopen_ticket(
  p_ticket_id uuid,
  p_reason text
)
returns public.tickets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_reason text := trim(coalesce(p_reason, ''));
  v_recipient record;
begin
  if v_actor is null then
    raise exception 'Unauthorized.';
  end if;

  if char_length(v_reason) < 5 then
    raise exception 'Alasan reopen minimal 5 karakter.';
  end if;

  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket tidak ditemukan.';
  end if;

  if v_ticket.status not in ('RESOLVED','CLOSED') then
    raise exception 'Hanya ticket DONE yang dapat dibuka kembali.';
  end if;

  if not (v_ticket.created_by = v_actor or public.is_it()) then
    raise exception 'Anda tidak memiliki akses untuk reopen ticket ini.';
  end if;

  select coalesce(name, 'User') into v_actor_name
  from public.profiles
  where id = v_actor and is_active = true;

  if v_actor_name is null then
    raise exception 'Akun tidak aktif.';
  end if;

  update public.tickets
  set
    status = 'OPEN',
    first_response_at = null,
    finished_at = null,
    resolved_at = null,
    closed_at = null,
    reopened_at = now(),
    reopened_by = v_actor,
    reopen_count = coalesce(reopen_count, 0) + 1
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_history(
    ticket_id,user_id,action,old_value,new_value,description,metadata
  ) values (
    p_ticket_id,v_actor,'REOPENED','DONE','OPEN',v_reason,
    jsonb_build_object('reopen_count',v_ticket.reopen_count)
  );

  if v_ticket.assigned_to is not null and v_ticket.assigned_to <> v_actor then
    perform public.create_helpdesk_notification(
      v_ticket.assigned_to,
      p_ticket_id,
      'TICKET_REOPENED',
      'Ticket dibuka kembali',
      v_actor_name || ' membuka kembali ' || v_ticket.ticket_number
    );
  elsif not public.is_it() then
    for v_recipient in
      select id from public.profiles
      where role in ('IT','ADMIN') and is_active = true and id <> v_actor
    loop
      perform public.create_helpdesk_notification(
        v_recipient.id,
        p_ticket_id,
        'TICKET_REOPENED',
        'Ticket dibuka kembali',
        v_actor_name || ' membuka kembali ' || v_ticket.ticket_number
      );
    end loop;
  end if;

  return v_ticket;
end;
$$;

revoke all on function public.reopen_ticket(uuid,text) from public;
grant execute on function public.reopen_ticket(uuid,text) to authenticated;

-- ---------- Attachment audit and integrity ----------
create or replace function public.valid_attachment_comment(
  p_ticket_id uuid,
  p_comment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_comment_id is null or exists (
    select 1
    from public.ticket_comments c
    where c.id = p_comment_id
      and c.ticket_id = p_ticket_id
  );
$$;

create or replace function public.log_attachment_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ticket_history(
    ticket_id,user_id,action,new_value,description,metadata
  ) values (
    new.ticket_id,
    new.uploaded_by,
    'ATTACHMENT_ADDED',
    new.file_name,
    case when new.comment_id is null
      then 'Ticket attachment uploaded'
      else 'Conversation attachment uploaded'
    end,
    case when new.comment_id is null
      then '{}'::jsonb
      else jsonb_build_object('comment_id',new.comment_id)
    end
  );
  return new;
end;
$$;

drop trigger if exists attachment_history on public.ticket_attachments;
create trigger attachment_history
after insert on public.ticket_attachments
for each row execute function public.log_attachment_created();

-- ---------- RLS hardening ----------
alter table public.sla_policies enable row level security;

grant select, insert, update, delete on public.sla_policies to authenticated;

drop policy if exists "sla policies read" on public.sla_policies;
drop policy if exists "sla policies admin write" on public.sla_policies;
create policy "sla policies read" on public.sla_policies
for select to authenticated using (true);
create policy "sla policies admin write" on public.sla_policies
for all to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

-- Users cannot edit their own authorization/profile control fields directly.
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
for update to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

-- Keep only one predictable attachment insert policy.
drop policy if exists "attachments create" on public.ticket_attachments;
create policy "attachments create" on public.ticket_attachments
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_access_ticket(ticket_id)
  and public.valid_attachment_comment(ticket_id, comment_id)
);

-- Evidence cannot be removed directly by normal employees through Storage API.
drop policy if exists "ticket files delete own" on storage.objects;
drop policy if exists "ticket files delete it" on storage.objects;
create policy "ticket files delete it" on storage.objects
for delete to authenticated
using (
  bucket_id = 'ticket-attachments'
  and public.is_it()
  and public.can_access_storage_object(name)
);

-- Ensure master-data write remains ADMIN-only.
drop policy if exists "departments admin write" on public.departments;
create policy "departments admin write" on public.departments
for all to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

drop policy if exists "categories admin write" on public.ticket_categories;
create policy "categories admin write" on public.ticket_categories
for all to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

-- Prevent accidental direct audit manipulation. RLS has no INSERT/UPDATE/DELETE
-- policy for authenticated users; trigger functions remain SECURITY DEFINER.
revoke insert, update, delete on public.ticket_history from authenticated;

-- Keep table access needed by the application explicit.
grant select on public.ticket_history to authenticated;
grant select, insert on public.ticket_comments to authenticated;
grant select, insert on public.ticket_attachments to authenticated;
