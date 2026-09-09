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
