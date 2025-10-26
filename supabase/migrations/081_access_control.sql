set search_path to public;

-- Extend user_role enum with super_admin
do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.user_role'::regtype
      and enumlabel = 'super_admin'
  ) then
    alter type public.user_role add value 'super_admin';
  end if;
end
$$;

-- Create enums for invites and audit actions if missing
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'revoked', 'used', 'expired', 'superseded');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type public.audit_action as enum (
      'ROLE_ASSIGNED',
      'ROLE_REVOKED',
      'INVITE_CREATED',
      'INVITE_REVOKED',
      'INVITE_ACCEPTED',
      'TRANSACTION_CONFIRMED'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assignment_source') then
    create type public.assignment_source as enum ('invite', 'manual', 'seed', 'system');
  end if;
end
$$;

-- Profiles global role column
alter table public.profiles
  add column if not exists app_role public.user_role default 'viewer';

-- Guild user roles: add surrogate key and metadata
alter table public.guild_user_roles
  add column if not exists id uuid default gen_random_uuid();

update public.guild_user_roles
  set id = gen_random_uuid()
  where id is null;

alter table public.guild_user_roles
  alter column id set not null;

alter table public.guild_user_roles
  drop constraint if exists guild_user_roles_pkey;

alter table public.guild_user_roles
  add primary key (id);

alter table public.guild_user_roles
  add column if not exists assigned_by_user_id uuid references public.profiles (id);

alter table public.guild_user_roles
  add column if not exists assigned_at timestamptz not null default timezone('utc', now());

alter table public.guild_user_roles
  add column if not exists revoked_at timestamptz;

alter table public.guild_user_roles
  add column if not exists source public.assignment_source not null default 'manual';

create index if not exists guild_user_roles_guild_role_idx
  on public.guild_user_roles (guild_id, role)
  where revoked_at is null;

create index if not exists guild_user_roles_active_lookup_idx
  on public.guild_user_roles (guild_id, user_id)
  where revoked_at is null;

-- Ensure uniqueness for active assignments
create unique index if not exists guild_user_roles_active_unique
  on public.guild_user_roles (guild_id, user_id)
  where revoked_at is null;

-- Audit logs adjustments
alter table public.audit_logs
  alter column guild_id drop not null;

alter table public.audit_logs
  rename column user_id to actor_user_id;

alter table public.audit_logs
  add column if not exists target_user_id uuid references public.profiles (id);

alter table public.audit_logs
  rename column payload to metadata;

alter table public.audit_logs
  alter column metadata set default '{}'::jsonb;

alter table public.audit_logs
  alter column metadata set not null;

update public.audit_logs
  set action = 'TRANSACTION_CONFIRMED'
  where action = 'transaction.confirmed';

alter table public.audit_logs
  alter column action type public.audit_action using action::public.audit_action;

-- Guild invites table
create table if not exists public.guild_invites (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  email text,
  token_hash text not null,
  default_role public.user_role not null,
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  created_by_user_id uuid not null references public.profiles (id),
  used_at timestamptz,
  used_by_user_id uuid references public.profiles (id),
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists guild_invites_token_hash_idx
  on public.guild_invites (token_hash);

create index if not exists guild_invites_guild_status_idx
  on public.guild_invites (guild_id, status);

create index if not exists guild_invites_email_idx
  on public.guild_invites (guild_id, email)
  where status in ('pending', 'superseded');

-- Trigger to maintain updated_at on guild_invites
drop trigger if exists guild_invites_set_updated_at on public.guild_invites;
create trigger guild_invites_set_updated_at
  before update on public.guild_invites
  for each row execute function public.set_updated_at();
