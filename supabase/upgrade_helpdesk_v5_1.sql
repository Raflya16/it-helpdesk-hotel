-- =====================================================
-- Hotel IT Helpdesk - Upgrade V5.1
-- Optional Property for common areas + simplified location model.
-- Run AFTER upgrade_helpdesk_v5.sql if V5 was already applied.
-- Safe to run more than once.
-- =====================================================

create extension if not exists pgcrypto;

-- Area may be common/lintas property, so property_id must be nullable.
alter table public.hotel_areas
  alter column property_id drop not null;

-- Remove the old table-level uniqueness constraint if it exists.
alter table public.hotel_areas
  drop constraint if exists hotel_areas_property_id_name_key;

create unique index if not exists hotel_areas_property_name_unique
  on public.hotel_areas(property_id, name)
  where property_id is not null;

-- Consolidate the duplicated Ballroom / Meeting Room rows created by V5
-- into one common area while preserving ticket history.
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

  if v_common_id is null then
    insert into public.hotel_areas(property_id, name, description, is_active)
    values (null, 'Ballroom / Meeting Room', 'Area umum untuk Four Points dan Fairfield', true)
    returning id into v_common_id;
  else
    update public.hotel_areas
    set property_id = null,
        description = coalesce(description, 'Area umum untuk Four Points dan Fairfield')
    where id = v_common_id;
  end if;

  for v_duplicate in
    select id
    from public.hotel_areas
    where name = 'Ballroom / Meeting Room'
      and id <> v_common_id
  loop
    update public.tickets
    set area_id = v_common_id
    where area_id = v_duplicate.id;

    delete from public.hotel_areas
    where id = v_duplicate.id;
  end loop;
end $$;

create unique index if not exists hotel_areas_common_name_unique
  on public.hotel_areas(name)
  where property_id is null;

-- Add Front Desk explicitly for each real property if it is not present yet.
insert into public.hotel_areas(property_id, name)
select p.id, 'Front Desk'
from public.hotel_properties p
where p.name in ('Four Points by Sheraton Bekasi','Fairfield by Marriott Bekasi')
  and not exists (
    select 1 from public.hotel_areas a
    where a.property_id = p.id and a.name = 'Front Desk'
  );

-- A common area accepts a null Property. A property-specific area still
-- requires and validates the matching Property.
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
