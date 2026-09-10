-- =====================================================
-- Hotel IT Helpdesk - Upgrade V5.2
-- Flexible location model: Property is optional context,
-- Area is a global master and is never filtered by Property.
-- Run AFTER upgrade_helpdesk_v5_1.sql.
-- Safe to run more than once.
-- =====================================================

create extension if not exists pgcrypto;

-- Keep property_id for backward compatibility, but V5.2 no longer uses it
-- to scope an Area. Existing area rows are normalized to global rows.
alter table public.hotel_areas
  alter column property_id drop not null;

alter table public.hotel_areas
  drop constraint if exists hotel_areas_property_id_name_key;

drop index if exists public.hotel_areas_property_name_unique;
drop index if exists public.hotel_areas_common_name_unique;
drop index if exists public.hotel_areas_name_unique_ci;

-- Merge duplicate Area names that may have been created once per Property.
-- Ticket references are moved to one canonical Area before duplicates are deleted.
do $$
declare
  v_group record;
  v_canonical_id uuid;
  v_duplicate record;
begin
  for v_group in
    select lower(btrim(name)) as normalized_name
    from public.hotel_areas
    group by lower(btrim(name))
  loop
    select id into v_canonical_id
    from public.hotel_areas
    where lower(btrim(name)) = v_group.normalized_name
    order by (property_id is null) desc, created_at, id
    limit 1;

    for v_duplicate in
      select id
      from public.hotel_areas
      where lower(btrim(name)) = v_group.normalized_name
        and id <> v_canonical_id
    loop
      update public.tickets
      set area_id = v_canonical_id
      where area_id = v_duplicate.id;

      delete from public.hotel_areas
      where id = v_duplicate.id;
    end loop;

    update public.hotel_areas
    set property_id = null,
        name = btrim(name)
    where id = v_canonical_id;
  end loop;
end $$;

-- One Area name only, regardless of Property.
create unique index if not exists hotel_areas_name_unique_ci
  on public.hotel_areas(lower(btrim(name)));

create index if not exists hotel_areas_active_name_idx
  on public.hotel_areas(is_active, name);

-- Property and Area are intentionally independent in V5.2.
-- The trigger only verifies that the chosen Area actually exists.
create or replace function public.validate_ticket_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.area_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.hotel_areas
    where id = new.area_id
  ) then
    raise exception 'Area tidak ditemukan.';
  end if;

  return new;
end;
$$;

drop trigger if exists ticket_validate_location on public.tickets;
create trigger ticket_validate_location
before insert or update of property_id, area_id on public.tickets
for each row execute function public.validate_ticket_location();

-- Ensure the standard global Area choices are available. Admin can add more
-- from Settings at any time without linking them to a Property.
insert into public.hotel_areas(property_id, name)
select null, v.name
from (
  values
    ('Back Office'),
    ('Ballroom / Meeting Room'),
    ('Engineering / Utility'),
    ('Front Desk'),
    ('Front Office'),
    ('Guest Room'),
    ('IT / Server Room'),
    ('Kitchen'),
    ('Lobby / Public Area'),
    ('Other'),
    ('Restaurant')
) as v(name)
where not exists (
  select 1
  from public.hotel_areas a
  where lower(btrim(a.name)) = lower(btrim(v.name))
);
