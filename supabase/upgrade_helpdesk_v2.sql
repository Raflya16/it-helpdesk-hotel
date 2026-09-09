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
