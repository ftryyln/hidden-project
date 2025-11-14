set search_path to public;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  boss_name text,
  map_name text,
  started_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint attendance_sessions_boss_or_map check (
    boss_name is not null
    or map_name is not null
  )
);

create index if not exists attendance_sessions_guild_started_idx
  on public.attendance_sessions (guild_id, started_at desc);

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row
  execute function public.set_updated_at();

create table if not exists public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  note text,
  loot_tag text,
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint attendance_entries_unique_member unique (session_id, member_id)
);

create index if not exists attendance_entries_session_idx
  on public.attendance_entries (session_id);

create index if not exists attendance_entries_member_idx
  on public.attendance_entries (member_id);

drop trigger if exists attendance_entries_set_updated_at on public.attendance_entries;
create trigger attendance_entries_set_updated_at
  before update on public.attendance_entries
  for each row
  execute function public.set_updated_at();

create table if not exists public.attendance_activity (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  action text not null check (
    action in (
      'CREATED',
      'UPDATED',
      'DELETED',
      'MEMBER_ADDED',
      'MEMBER_REMOVED'
    )
  ),
  details jsonb,
  performed_by uuid not null references public.profiles (id),
  performed_at timestamptz not null default timezone('utc', now())
);

create index if not exists attendance_activity_session_idx
  on public.attendance_activity (session_id, performed_at desc);
