set search_path to public;

-- Add confirmation fields to attendance_entries table
alter table public.attendance_entries
  add column if not exists confirmed boolean not null default false,
  add column if not exists confirmed_by uuid references public.profiles (id),
  add column if not exists confirmed_at timestamptz,
  add column if not exists discord_message_id text;

-- Create index for pending entries query
create index if not exists attendance_entries_confirmed_idx
  on public.attendance_entries (session_id, confirmed)
  where confirmed = false;

-- Create index for discord message lookup
create index if not exists attendance_entries_discord_message_idx
  on public.attendance_entries (discord_message_id)
  where discord_message_id is not null;

-- Add comment for discord_username in members.contact field
comment on column public.members.contact is 
  'Contact information in JSONB format. Can include: {"discord_username": "username", "email": "user@example.com", ...}';

-- Create view for pending attendance with member details
create or replace view public.pending_attendance_view as
select
  ae.id as entry_id,
  ae.session_id,
  ae.member_id,
  ae.note,
  ae.loot_tag,
  ae.discord_message_id,
  ae.created_at as entry_created_at,
  ae.created_by as entry_created_by,
  s.boss_name,
  s.map_name,
  s.started_at as session_started_at,
  s.guild_id,
  m.in_game_name as member_name,
  m.contact->>'discord_username' as discord_username,
  p.display_name as created_by_name
from public.attendance_entries ae
join public.attendance_sessions s on ae.session_id = s.id
join public.members m on ae.member_id = m.id
left join public.profiles p on ae.created_by = p.id
where ae.confirmed = false
order by ae.created_at desc;

-- Grant access to view
grant select on public.pending_attendance_view to authenticated, service_role;

-- Function to confirm attendance entry
create or replace function public.confirm_attendance_entry(
  p_entry_id uuid,
  p_confirmed_by uuid
)
returns public.attendance_entries
language plpgsql
security definer
as $$
declare
  v_entry public.attendance_entries;
  v_session public.attendance_sessions;
begin
  -- Get the entry
  select * into v_entry
  from public.attendance_entries
  where id = p_entry_id;

  if not found then
    raise exception 'Attendance entry not found';
  end if;

  if v_entry.confirmed then
    raise exception 'Attendance entry already confirmed';
  end if;

  -- Get the session to check guild_id
  select * into v_session
  from public.attendance_sessions
  where id = v_entry.session_id;

  -- Check if user has permission (officer, leader, or super_admin)
  if not exists (
    select 1
    from public.guild_user_roles
    where user_id = p_confirmed_by
      and guild_id = v_session.guild_id
      and role in ('OFFICER', 'LEADER', 'SUPER_ADMIN')
  ) then
    raise exception 'Insufficient permissions to confirm attendance';
  end if;

  -- Update the entry
  update public.attendance_entries
  set
    confirmed = true,
    confirmed_by = p_confirmed_by,
    confirmed_at = timezone('utc', now()),
    updated_by = p_confirmed_by,
    updated_at = timezone('utc', now())
  where id = p_entry_id
  returning * into v_entry;

  -- Log the activity
  insert into public.attendance_activity (
    session_id,
    action,
    details,
    performed_by
  ) values (
    v_entry.session_id,
    'MEMBER_CONFIRMED',
    jsonb_build_object(
      'entry_id', v_entry.id,
      'member_id', v_entry.member_id
    ),
    p_confirmed_by
  );

  return v_entry;
end;
$$;

-- Grant execute permission
grant execute on function public.confirm_attendance_entry(uuid, uuid) to authenticated, service_role;

-- Function to bulk confirm attendance entries
create or replace function public.bulk_confirm_attendance_entries(
  p_entry_ids uuid[],
  p_confirmed_by uuid
)
returns setof public.attendance_entries
language plpgsql
security definer
as $$
declare
  v_entry_id uuid;
  v_result public.attendance_entries;
begin
  foreach v_entry_id in array p_entry_ids
  loop
    begin
      select * into v_result
      from public.confirm_attendance_entry(v_entry_id, p_confirmed_by);
      
      return next v_result;
    exception when others then
      -- Log error but continue with other entries
      raise notice 'Failed to confirm entry %: %', v_entry_id, sqlerrm;
    end;
  end loop;
end;
$$;

-- Grant execute permission
grant execute on function public.bulk_confirm_attendance_entries(uuid[], uuid) to authenticated, service_role;
