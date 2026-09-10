-- =====================================================
-- Hotel IT Helpdesk - Upgrade V5
-- Location master data, internal notes, realtime notifications,
-- stronger audit/RLS, and report-ready ticket fields.
-- Run AFTER upgrade_helpdesk_v3.sql.
-- =====================================================

create extension if not exists pgcrypto;

-- ---------- Property / Area master data ----------
create table if not exists public.hotel_properties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_areas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid null references public.hotel_properties(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Also normalize installations that already ran the first V5 location schema.
alter table public.hotel_areas
  alter column property_id drop not null;

alter table public.hotel_areas
  drop constraint if exists hotel_areas_property_id_name_key;

create index if not exists hotel_areas_property_idx
  on public.hotel_areas(property_id, is_active, name);

create unique index if not exists hotel_areas_property_name_unique
  on public.hotel_areas(property_id, name)
  where property_id is not null;

create unique index if not exists hotel_areas_common_name_unique
  on public.hotel_areas(name)
  where property_id is null;

alter table public.tickets
  add column if not exists property_id uuid null references public.hotel_properties(id) on delete set null;

alter table public.tickets
  add column if not exists area_id uuid null references public.hotel_areas(id) on delete set null;

create index if not exists tickets_property_idx on public.tickets(property_id);
create index if not exists tickets_area_idx on public.tickets(area_id);

-- Existing free-text `location` is retained as Location Detail, so old tickets remain intact.

-- ---------- Internal conversation notes ----------
alter table public.ticket_comments
  add column if not exists is_internal boolean not null default false;

create index if not exists ticket_comments_internal_idx
  on public.ticket_comments(ticket_id, is_internal, created_at);

-- ---------- Master updated_at triggers ----------
drop trigger if exists hotel_properties_updated_at on public.hotel_properties;
create trigger hotel_properties_updated_at
before update on public.hotel_properties
for each row execute function public.set_updated_at();

drop trigger if exists hotel_areas_updated_at on public.hotel_areas;
create trigger hotel_areas_updated_at
before update on public.hotel_areas
for each row execute function public.set_updated_at();

-- ---------- Validate property / area consistency ----------
create or replace function public.validate_ticket_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_area_property uuid;
begin
  if new.area_id is null then
    return new;
  end if;

  select property_id into v_area_property
  from public.hotel_areas
  where id = new.area_id;

  if not found then
    raise exception 'Area tidak ditemukan.';
  end if;

  -- property_id NULL pada master area berarti area umum/lintas property.
  -- Untuk area umum, ticket boleh tanpa Property atau tetap menyebut Property jika diperlukan.
  if v_area_property is null then
    return new;
  end if;

  if new.property_id is null then
    raise exception 'Property wajib dipilih untuk area khusus ini.';
  end if;

  if v_area_property <> new.property_id then
    raise exception 'Area tidak sesuai dengan Property yang dipilih.';
  end if;

  return new;
end;
$$;

drop trigger if exists ticket_validate_location on public.tickets;
create trigger ticket_validate_location
before insert or update of property_id, area_id on public.tickets
for each row execute function public.validate_ticket_location();

-- ---------- Safer comment/attachment visibility helpers ----------
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
      and (not c.is_internal or public.is_it())
  );
$$;

create or replace function public.can_read_ticket_attachment(
  p_ticket_id uuid,
  p_comment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_access_ticket(p_ticket_id)
    and (
      p_comment_id is null
      or public.is_it()
      or exists (
        select 1
        from public.ticket_comments c
        where c.id = p_comment_id
          and c.ticket_id = p_ticket_id
          and c.is_internal = false
      )
    );
$$;

-- Storage paths for conversation files are:
-- {user_id}/{ticket_id}/conversation/{comment_id}/{filename}
create or replace function public.can_access_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket_id uuid;
  v_comment_id uuid;
  v_internal boolean;
begin
  begin
    v_ticket_id := split_part(p_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;

  if not public.can_access_ticket(v_ticket_id) then
    return false;
  end if;

  if split_part(p_name, '/', 3) = 'conversation' then
    begin
      v_comment_id := split_part(p_name, '/', 4)::uuid;
    exception when others then
      return false;
    end;

    select c.is_internal into v_internal
    from public.ticket_comments c
    where c.id = v_comment_id
      and c.ticket_id = v_ticket_id;

    if coalesce(v_internal, false) and not public.is_it() then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- ---------- Internal-note aware comment trigger ----------
create or replace function public.log_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_author_role text;
  v_author_name text;
  v_recipient record;
begin
  select * into v_ticket
  from public.tickets
  where id = new.ticket_id;

  select role, coalesce(name, 'User')
  into v_author_role, v_author_name
  from public.profiles
  where id = new.user_id;

  if new.is_internal then
    if v_author_role not in ('IT','ADMIN') then
      raise exception 'Internal Note hanya dapat dibuat oleh IT/Admin.';
    end if;

    insert into public.ticket_history(
      ticket_id,user_id,action,description,metadata
    ) values (
      new.ticket_id,new.user_id,'INTERNAL_NOTE_ADDED','Internal note added',
      jsonb_build_object('comment_id',new.id)
    );

    -- Internal notes do not count as first response and are never sent to reporter.
    if v_ticket.assigned_to is not null and v_ticket.assigned_to <> new.user_id then
      perform public.create_helpdesk_notification(
        v_ticket.assigned_to,
        new.ticket_id,
        'INTERNAL_NOTE_ADDED',
        'Internal note baru',
        coalesce(v_author_name, 'IT') || ' menambahkan catatan pada ' || v_ticket.ticket_number
      );
    end if;

    return new;
  end if;

  insert into public.ticket_history(
    ticket_id,user_id,action,description,metadata
  ) values (
    new.ticket_id,new.user_id,'COMMENT_ADDED','Public comment added',
    jsonb_build_object('comment_id',new.id)
  );

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

drop trigger if exists comment_history on public.ticket_comments;
create trigger comment_history
after insert on public.ticket_comments
for each row execute function public.log_comment_created();

-- ---------- Attachment audit: hide internal filenames from employee audit ----------
create or replace function public.log_attachment_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_internal boolean := false;
begin
  if new.comment_id is not null then
    select coalesce(c.is_internal, false)
    into v_internal
    from public.ticket_comments c
    where c.id = new.comment_id;
  end if;

  insert into public.ticket_history(
    ticket_id,user_id,action,new_value,description,metadata
  ) values (
    new.ticket_id,
    new.uploaded_by,
    case when v_internal then 'INTERNAL_ATTACHMENT_ADDED' else 'ATTACHMENT_ADDED' end,
    new.file_name,
    case
      when v_internal then 'Internal note attachment uploaded'
      when new.comment_id is null then 'Ticket attachment uploaded'
      else 'Conversation attachment uploaded'
    end,
    case when new.comment_id is null
      then '{}'::jsonb
      else jsonb_build_object('comment_id',new.comment_id,'internal',v_internal)
    end
  );
  return new;
end;
$$;

drop trigger if exists attachment_history on public.ticket_attachments;
create trigger attachment_history
after insert on public.ticket_attachments
for each row execute function public.log_attachment_created();

-- ---------- Stronger ticket audit including location ----------
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
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'STATUS_CHANGED',old.status,new.status,'Ticket status changed',jsonb_build_object('source','ticket_update'));

    if new.created_by is distinct from v_actor then
      perform public.create_helpdesk_notification(
        new.created_by,new.id,'STATUS_CHANGED','Status ticket berubah',
        coalesce(v_actor_name, 'IT') || ' memperbarui status ' || new.ticket_number
      );
    end if;
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'ASSIGNEE_CHANGED',old.assigned_to::text,new.assigned_to::text,'Ticket assignee changed','{}'::jsonb);

    if new.assigned_to is not null and new.assigned_to is distinct from v_actor then
      perform public.create_helpdesk_notification(
        new.assigned_to,new.id,'ASSIGNED','Ticket ditugaskan kepada Anda',
        new.ticket_number || ' membutuhkan penanganan'
      );
    end if;
  end if;

  if old.priority is distinct from new.priority then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'PRIORITY_CHANGED',old.priority,new.priority,'Ticket priority changed','{}'::jsonb);
  end if;

  if old.category_id is distinct from new.category_id then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'CATEGORY_CHANGED',old.category_id::text,new.category_id::text,'Ticket category changed','{}'::jsonb);
  end if;

  if old.department_id is distinct from new.department_id then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'DEPARTMENT_CHANGED',old.department_id::text,new.department_id::text,'Ticket department changed','{}'::jsonb);
  end if;

  if old.property_id is distinct from new.property_id then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'PROPERTY_CHANGED',old.property_id::text,new.property_id::text,'Ticket property changed','{}'::jsonb);
  end if;

  if old.area_id is distinct from new.area_id then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'AREA_CHANGED',old.area_id::text,new.area_id::text,'Ticket area changed','{}'::jsonb);
  end if;

  if old.location is distinct from new.location then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'LOCATION_CHANGED',old.location,new.location,'Location detail changed','{}'::jsonb);
  end if;

  if old.resolution_note is distinct from new.resolution_note then
    insert into public.ticket_history(ticket_id,user_id,action,old_value,new_value,description,metadata)
    values (new.id,v_actor,'RESOLUTION_NOTE_UPDATED',null,null,'Resolution Note updated',jsonb_build_object('has_note',new.resolution_note is not null));
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

-- ---------- RLS ----------
alter table public.hotel_properties enable row level security;
alter table public.hotel_areas enable row level security;

grant select, insert, update, delete on public.hotel_properties to authenticated;
grant select, insert, update, delete on public.hotel_areas to authenticated;

drop policy if exists "hotel properties read" on public.hotel_properties;
drop policy if exists "hotel properties admin write" on public.hotel_properties;
create policy "hotel properties read" on public.hotel_properties
for select to authenticated using (true);
create policy "hotel properties admin write" on public.hotel_properties
for all to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

drop policy if exists "hotel areas read" on public.hotel_areas;
drop policy if exists "hotel areas admin write" on public.hotel_areas;
create policy "hotel areas read" on public.hotel_areas
for select to authenticated using (true);
create policy "hotel areas admin write" on public.hotel_areas
for all to authenticated
using (public.current_user_role() = 'ADMIN')
with check (public.current_user_role() = 'ADMIN');

-- Internal notes are visible only to IT/Admin. Public conversation remains visible to reporter.
drop policy if exists "comments read" on public.ticket_comments;
drop policy if exists "comments create" on public.ticket_comments;
create policy "comments read" on public.ticket_comments
for select to authenticated
using (
  public.can_access_ticket(ticket_id)
  and (is_internal = false or public.is_it())
);
create policy "comments create" on public.ticket_comments
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_ticket(ticket_id)
  and (is_internal = false or public.is_it())
);

-- Internal-note attachments must follow the comment visibility.
drop policy if exists "attachments read" on public.ticket_attachments;
create policy "attachments read" on public.ticket_attachments
for select to authenticated
using (public.can_read_ticket_attachment(ticket_id, comment_id));

drop policy if exists "attachments create" on public.ticket_attachments;
create policy "attachments create" on public.ticket_attachments
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_access_ticket(ticket_id)
  and public.valid_attachment_comment(ticket_id, comment_id)
);

-- Hide internal-note audit events from reporter/employee.
drop policy if exists "history read" on public.ticket_history;
create policy "history read" on public.ticket_history
for select to authenticated
using (
  public.can_access_ticket(ticket_id)
  and (
    public.is_it()
    or action not in ('INTERNAL_NOTE_ADDED','INTERNAL_ATTACHMENT_ADDED')
  )
);

-- Storage read now also respects internal comments.
drop policy if exists "ticket files read" on storage.objects;
create policy "ticket files read" on storage.objects
for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and public.can_access_storage_object(name)
);

-- ---------- Realtime notifications ----------
-- Keeps the existing 15-second polling as fallback, while allowing instant updates
-- when Supabase Realtime is available for this project.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when insufficient_privilege then
  raise notice 'Could not add notifications to supabase_realtime publication; polling will still work.';
end $$;

-- ---------- Seed properties and common hotel areas ----------
insert into public.hotel_properties(name, description)
values
  ('Four Points by Sheraton Bekasi', 'Four Points by Sheraton Bekasi'),
  ('Fairfield by Marriott Bekasi', 'Fairfield by Marriott Bekasi')
on conflict (name) do nothing;

-- Area yang memang berbeda per hotel tetap terikat ke property.
insert into public.hotel_areas(property_id, name)
select p.id, a.name
from public.hotel_properties p
cross join (
  values
    ('Front Office'),
    ('Front Desk'),
    ('Lobby / Public Area'),
    ('Guest Room'),
    ('Restaurant'),
    ('Kitchen'),
    ('Back Office'),
    ('Engineering / Utility'),
    ('IT / Server Room'),
    ('Other')
) as a(name)
where p.name in ('Four Points by Sheraton Bekasi','Fairfield by Marriott Bekasi')
on conflict do nothing;

-- Ballroom / Meeting Room dipakai bersama. Property tidak wajib untuk area ini.
insert into public.hotel_areas(property_id, name, description)
select null, 'Ballroom / Meeting Room', 'Area umum untuk Four Points dan Fairfield'
where not exists (
  select 1 from public.hotel_areas
  where property_id is null and name = 'Ballroom / Meeting Room'
);

-- If an earlier V5 created one Ballroom / Meeting Room row per property,
-- consolidate them into the common row and preserve ticket references.
do $$
declare
  v_common_id uuid;
  v_duplicate record;
begin
  select id into v_common_id
  from public.hotel_areas
  where name = 'Ballroom / Meeting Room'
  order by (property_id is null) desc, created_at, id
  limit 1;

  if v_common_id is not null then
    update public.hotel_areas
    set property_id = null,
        description = coalesce(description, 'Area umum untuk Four Points dan Fairfield')
    where id = v_common_id;

    for v_duplicate in
      select id from public.hotel_areas
      where name = 'Ballroom / Meeting Room' and id <> v_common_id
    loop
      update public.tickets set area_id = v_common_id where area_id = v_duplicate.id;
      delete from public.hotel_areas where id = v_duplicate.id;
    end loop;
  end if;
end $$;
