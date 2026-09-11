-- ============================================================
-- Hotel IT Helpdesk - Upgrade V6
-- Safe ticket cancellation / duplicate linking + production UX support.
-- Run AFTER upgrade_helpdesk_v5_3.sql.
-- ============================================================

-- ---------- Cancellation metadata ----------
alter table public.tickets
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancel_reason_code text,
  add column if not exists cancel_reason text,
  add column if not exists duplicate_of uuid;

-- Make the self reference predictable for PostgREST/Supabase joins and reruns.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_duplicate_of_fkey'
      and conrelid = 'public.tickets'::regclass
  ) then
    alter table public.tickets
      add constraint tickets_duplicate_of_fkey
      foreign key (duplicate_of)
      references public.tickets(id)
      on delete set null;
  end if;
end $$;

alter table public.tickets
  drop constraint if exists tickets_cancel_reason_code_check;

alter table public.tickets
  add constraint tickets_cancel_reason_code_check
  check (
    cancel_reason_code is null
    or cancel_reason_code in ('WRONG_TICKET','RESOLVED_SELF','DUPLICATE','OTHER')
  );

alter table public.tickets
  drop constraint if exists tickets_status_check;

alter table public.tickets
  add constraint tickets_status_check
  check (
    status in (
      'OPEN','ASSIGNED','IN_PROGRESS','WAITING_USER',
      'RESOLVED','CLOSED','CANCELLED'
    )
  );

create index if not exists tickets_cancelled_at_idx
  on public.tickets(cancelled_at desc)
  where status = 'CANCELLED';

create index if not exists tickets_duplicate_of_idx
  on public.tickets(duplicate_of)
  where duplicate_of is not null;

-- ---------- Guard cancelled tickets ----------
-- A cancelled ticket is a terminal audit record. It cannot be silently re-opened
-- through a normal UPDATE, and CANCELLED must be entered through cancel_ticket().
create or replace function public.guard_ticket_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'CANCELLED' and new.status is distinct from 'CANCELLED' then
    raise exception 'Ticket yang sudah dibatalkan tidak dapat diubah kembali melalui update biasa.';
  end if;

  if old.status is distinct from 'CANCELLED'
     and new.status = 'CANCELLED'
     and (new.cancelled_at is null or new.cancelled_by is null or new.cancel_reason_code is null) then
    raise exception 'Gunakan aksi Hapus/Cancel Ticket agar alasan pembatalan tercatat.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_ticket_cancellation() from public;

drop trigger if exists ticket_cancellation_guard on public.tickets;
create trigger ticket_cancellation_guard
before update on public.tickets
for each row execute function public.guard_ticket_cancellation();

-- ---------- Cancel / soft-delete RPC ----------
create or replace function public.cancel_ticket(
  p_ticket_id uuid,
  p_reason_code text,
  p_reason_detail text default null,
  p_duplicate_ticket_number text default null
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
  v_is_it boolean := false;
  v_code text := upper(trim(coalesce(p_reason_code, '')));
  v_detail text := trim(coalesce(p_reason_detail, ''));
  v_reason text;
  v_duplicate_id uuid;
  v_duplicate_number text := upper(trim(coalesce(p_duplicate_ticket_number, '')));
begin
  if v_actor is null then
    raise exception 'Unauthorized.';
  end if;

  v_is_it := public.is_it();

  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket tidak ditemukan.';
  end if;

  if v_ticket.status in ('RESOLVED','CLOSED','CANCELLED') then
    raise exception 'Ticket yang sudah selesai atau dibatalkan tidak dapat dihapus.';
  end if;

  -- Reporter hanya boleh membatalkan ticket miliknya sebelum IT mulai merespons.
  if not v_is_it then
    if v_ticket.created_by <> v_actor then
      raise exception 'Anda hanya dapat menghapus ticket milik sendiri.';
    end if;

    if v_ticket.status not in ('OPEN','ASSIGNED') or v_ticket.first_response_at is not null then
      raise exception 'Ticket sudah mulai ditangani IT. Hubungi tim IT melalui Conversation jika perlu dibatalkan.';
    end if;
  end if;

  if v_code not in ('WRONG_TICKET','RESOLVED_SELF','DUPLICATE','OTHER') then
    raise exception 'Alasan pembatalan tidak valid.';
  end if;

  if v_code = 'WRONG_TICKET' then
    v_reason := case
      when char_length(v_detail) >= 5 then v_detail
      else 'Salah membuat ticket'
    end;
  elsif v_code = 'RESOLVED_SELF' then
    v_reason := case
      when char_length(v_detail) >= 5 then v_detail
      else 'Masalah sudah selesai sebelum ditangani IT'
    end;
  elsif v_code = 'DUPLICATE' then
    if v_duplicate_number = '' then
      raise exception 'Masukkan nomor ticket yang menjadi duplikat.';
    end if;

    select t.id, t.ticket_number
      into v_duplicate_id, v_duplicate_number
    from public.tickets t
    where upper(t.ticket_number) = v_duplicate_number
      and t.id <> p_ticket_id
      and (v_is_it or t.created_by = v_actor)
    limit 1;

    if v_duplicate_id is null then
      raise exception 'Ticket referensi duplikat tidak ditemukan atau tidak dapat diakses.';
    end if;

    v_reason := case
      when char_length(v_detail) >= 5 then v_detail
      else 'Duplikat dari ' || v_duplicate_number
    end;
  else
    if char_length(v_detail) < 5 then
      raise exception 'Jelaskan alasan pembatalan minimal 5 karakter.';
    end if;
    v_reason := v_detail;
  end if;

  select coalesce(name, 'User')
    into v_actor_name
  from public.profiles
  where id = v_actor;

  update public.tickets
  set
    status = 'CANCELLED',
    cancelled_at = now(),
    cancelled_by = v_actor,
    cancel_reason_code = v_code,
    cancel_reason = v_reason,
    duplicate_of = v_duplicate_id,
    finished_at = coalesce(finished_at, now())
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_history(
    ticket_id,
    user_id,
    action,
    old_value,
    new_value,
    description,
    metadata
  ) values (
    p_ticket_id,
    v_actor,
    case when v_code = 'DUPLICATE' then 'TICKET_MARKED_DUPLICATE' else 'TICKET_CANCELLED' end,
    null,
    v_code,
    v_reason,
    jsonb_build_object(
      'duplicate_of', v_duplicate_id,
      'duplicate_ticket_number', nullif(v_duplicate_number, '')
    )
  );

  -- If reporter cancels an assigned ticket, notify the assigned IT so there is
  -- no operational miscommunication. If IT cancels it, the existing status
  -- audit trigger already notifies the reporter.
  if not v_is_it
     and v_ticket.assigned_to is not null
     and v_ticket.assigned_to <> v_actor then
    perform public.create_helpdesk_notification(
      v_ticket.assigned_to,
      p_ticket_id,
      'TICKET_CANCELLED',
      'Ticket dibatalkan reporter',
      coalesce(v_actor_name, 'Reporter') || ' membatalkan ' || v_ticket.ticket_number
    );
  end if;

  return v_ticket;
end;
$$;

revoke all on function public.cancel_ticket(uuid,text,text,text) from public;
grant execute on function public.cancel_ticket(uuid,text,text,text) to authenticated;
