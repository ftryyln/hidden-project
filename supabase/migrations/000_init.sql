-- Initial schema, RLS policies, and seed data for Guild Manager backend.
set check_function_bodies = off;

set search_path to public;

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "http";

-- Enumerations
create type public.tx_type as enum ('income', 'expense', 'transfer');
create type public.user_role as enum ('guild_admin', 'officer', 'member', 'viewer');
create type public.guild_role as enum ('leader', 'officer', 'raider', 'casual');
create type public.rarity as enum ('common', 'rare', 'epic', 'legendary', 'mythic');

-- Helper functions ---------------------------------------------------------

create or replace function public.user_role_priority(role_in user_role)
  returns integer
  language sql
  immutable
as $$
  select case role_in
    when 'guild_admin' then 400
    when 'officer' then 300
    when 'member' then 200
    when 'viewer' then 100
  end;
$$;

create or replace function public.user_in_guild(p_guild_id uuid)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.guild_user_roles gur
    where gur.guild_id = p_guild_id
      and gur.user_id = auth.uid()
  );
end;
$$;

create or replace function public.user_has_any_role(p_guild_id uuid, roles_to_check user_role[])
  returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_found boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id = auth.uid()
    and gur.role = any (roles_to_check)
  limit 1;

  return coalesce(v_found, false);
end;
$$;

create or replace function public.user_has_min_role(p_guild_id uuid, min_role user_role)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_found boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id = auth.uid()
    and public.user_role_priority(gur.role) >= public.user_role_priority(min_role)
  limit 1;

  return coalesce(v_found, false);
end;
$$;

-- Utility to keep updated_at columns in sync
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Profiles table mirrors auth.users ---------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index profiles_email_idx on public.profiles (email);

create or replace function public.handle_new_auth_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.enforce_profile_updates()
  returns trigger
  language plpgsql
as $$
begin
  if new.email is distinct from old.email then
    raise exception 'email is managed by auth service';
  end if;
  return new;
end;
$$;

create trigger profiles_only_display_name
  before update on public.profiles
  for each row
  execute function public.enforce_profile_updates();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Core domain tables ------------------------------------------------------

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  description text,
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger guilds_set_updated_at
  before update on public.guilds
  for each row execute function public.set_updated_at();

create table public.guild_user_roles (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (guild_id, user_id)
);

create index guild_user_roles_user_guild_idx on public.guild_user_roles (user_id, guild_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid references public.profiles (id),
  in_game_name text not null,
  role_in_guild public.guild_role not null,
  join_date date,
  contact jsonb not null default '{}'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index members_guild_active_idx on public.members (guild_id, is_active);

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  tx_type public.tx_type not null,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  evidence_path text,
  confirmed boolean not null default false,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index transactions_guild_created_idx on public.transactions (guild_id, created_at desc);

create table public.loot_records (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  boss_name text,
  item_name text not null,
  item_rarity public.rarity not null,
  estimated_value numeric(14,2) not null check (estimated_value >= 0),
  distributed boolean not null default false,
  distributed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index loot_records_guild_created_idx on public.loot_records (guild_id, created_at desc);

create table public.loot_distribution (
  id uuid primary key default gen_random_uuid(),
  loot_id uuid not null references public.loot_records (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  share_amount numeric(14,2) not null check (share_amount >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index loot_distribution_unique_member on public.loot_distribution (loot_id, member_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid references public.profiles (id),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_logs_guild_created_idx on public.audit_logs (guild_id, created_at desc);

-- Transaction confirmation audit trigger ----------------------------------

create or replace function public.on_transaction_confirm()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if (old.confirmed is distinct from true) and new.confirmed = true then
    insert into public.audit_logs (guild_id, user_id, action, payload)
    values (
      new.guild_id,
      coalesce(new.confirmed_by, auth.uid()),
      'transaction.confirmed',
      jsonb_build_object(
        'transaction_id', new.id,
        'confirmed_by', new.confirmed_by,
        'confirmed_at', new.confirmed_at
      )
    );
  end if;
  return new;
end;
$$;

create trigger transactions_on_confirm
  after update of confirmed on public.transactions
  for each row
  when (old.confirmed is distinct from true and new.confirmed = true)
  execute function public.on_transaction_confirm();

-- Reporting helpers -------------------------------------------------------

create or replace function public.guild_current_balance(p_guild_id uuid)
  returns numeric
  language sql
  stable
as $$
  select
    coalesce(sum(case when tx_type = 'income' then amount when tx_type = 'expense' then -amount else 0 end), 0)
  from public.transactions
  where guild_id = p_guild_id
    and confirmed = true;
$$;

create or replace view public.vw_monthly_summary as
  with base as (
    select
      t.guild_id,
      date_trunc('month', t.created_at) as month_bucket,
      sum(case when t.tx_type = 'income' then t.amount else 0 end) as income_total,
      sum(case when t.tx_type = 'expense' then t.amount else 0 end) as expense_total
    from public.transactions t
    where t.confirmed = true
    group by 1, 2
  )
  select
    guild_id,
    extract(year from month_bucket)::int as year,
    extract(month from month_bucket)::int as month,
    income_total,
    expense_total
  from base;

create or replace view public.vw_top_contributors as
  select
    s.guild_id,
    s.profile_id,
    s.contributor_name,
    s.income_total,
    rank() over (partition by s.guild_id order by s.income_total desc) as contribution_rank
  from (
    select
      t.guild_id,
      t.created_by as profile_id,
      coalesce(p.display_name, p.email) as contributor_name,
      sum(t.amount) as income_total
    from public.transactions t
    join public.profiles p on p.id = t.created_by
    where t.tx_type = 'income'
      and t.confirmed = true
    group by t.guild_id, t.created_by, p.display_name, p.email
  ) as s;

-- Storage helper ----------------------------------------------------------

create or replace function public.get_evidence_url(p_path text, p_expires integer default 3600)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_result jsonb;
begin
  if coalesce(trim(p_path), '') = '' then
    raise exception 'path cannot be empty';
  end if;

  v_result := storage.generate_presigned_url(
    bucket_id := 'evidence',
    object_name := p_path,
    expires_in := greatest(coalesce(p_expires, 3600), 60),
    download := false
  );

  return v_result;
end;
$$;

-- Row Level Security ------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_user_roles enable row level security;
alter table public.members enable row level security;
alter table public.transactions enable row level security;
alter table public.loot_records enable row level security;
alter table public.loot_distribution enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles RLS
create policy profiles_select_self_or_guild on public.profiles
  for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.guild_user_roles gur
      join public.members m on m.guild_id = gur.guild_id and m.user_id = public.profiles.id
      where gur.user_id = auth.uid()
        and gur.role in ('guild_admin', 'officer')
    )
  );

create policy profiles_update_self on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Guilds RLS
create policy guilds_select_members on public.guilds
  for select
  using (public.user_in_guild(id));

create policy guilds_manage_admin on public.guilds
  for all
  using (public.user_has_min_role(id, 'guild_admin'))
  with check (public.user_has_min_role(id, 'guild_admin'));

-- Guild user roles RLS
create policy guild_user_roles_select on public.guild_user_roles
  for select
  using (
    auth.uid() = user_id
    or public.user_has_min_role(guild_id, 'guild_admin')
  );

create policy guild_user_roles_manage on public.guild_user_roles
  for all
  using (public.user_has_min_role(guild_id, 'guild_admin'))
  with check (public.user_has_min_role(guild_id, 'guild_admin'));

-- Members RLS
create policy members_select on public.members
  for select
  using (public.user_in_guild(guild_id));

create policy members_modify on public.members
  for insert
  with check (public.user_has_min_role(guild_id, 'officer'));

create policy members_update on public.members
  for update
  using (public.user_has_min_role(guild_id, 'officer'))
  with check (public.user_has_min_role(guild_id, 'officer'));

create policy members_delete on public.members
  for delete
  using (public.user_has_min_role(guild_id, 'officer'));

-- Transactions RLS
create policy transactions_select on public.transactions
  for select
  using (public.user_in_guild(guild_id));

create policy transactions_insert on public.transactions
  for insert
  with check (public.user_has_any_role(guild_id, array['guild_admin', 'officer', 'member']));

create policy transactions_update_draft on public.transactions
  for update
  using (
    public.user_has_any_role(guild_id, array['guild_admin', 'officer', 'member'])
    and auth.uid() = created_by
    and confirmed = false
  )
  with check (
    public.user_has_any_role(guild_id, array['guild_admin', 'officer', 'member'])
    and auth.uid() = created_by
    and confirmed = false
  );

create policy transactions_confirm on public.transactions
  for update
  using (public.user_has_min_role(guild_id, 'officer'))
  with check (
    public.user_has_min_role(guild_id, 'officer')
    and (not confirmed or confirmed_by = auth.uid())
  );

create policy transactions_delete on public.transactions
  for delete
  using (public.user_has_min_role(guild_id, 'guild_admin'));

-- Loot records RLS
create policy loot_records_select on public.loot_records
  for select
  using (public.user_in_guild(guild_id));

create policy loot_records_modify on public.loot_records
  for all
  using (public.user_has_min_role(guild_id, 'officer'))
  with check (public.user_has_min_role(guild_id, 'officer'));

-- Loot distribution RLS
create policy loot_distribution_select on public.loot_distribution
  for select
  using (
    public.user_in_guild(
      (select lr.guild_id from public.loot_records lr where lr.id = loot_distribution.loot_id)
    )
  );

create policy loot_distribution_modify on public.loot_distribution
  for all
  using (
    public.user_has_min_role(
      (select lr.guild_id from public.loot_records lr where lr.id = loot_distribution.loot_id),
      'officer'
    )
  )
  with check (
    public.user_has_min_role(
      (select lr.guild_id from public.loot_records lr where lr.id = loot_distribution.loot_id),
      'officer'
    )
  );

-- Audit logs RLS
create policy audit_logs_select on public.audit_logs
  for select
  using (public.user_has_min_role(guild_id, 'officer'));

-- Seed data ---------------------------------------------------------------

insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_sent_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_user_meta_data,
  raw_app_meta_data,
  aud,
  role,
  created_at,
  updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'admin@valhalla.gg',
  '$2a$10$CQZCbohl28V/a9KqWiQieeqPqTQp1H3UX0YPD6/COM24kTx5cDIeW', -- password: Valhalla!23
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now()),
  null,
  timezone('utc', now()),
  jsonb_build_object('display_name', 'Ayla Stormborn'),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  'authenticated',
  'authenticated',
  timezone('utc', now()),
  timezone('utc', now())
)
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  created_at,
  last_sign_in_at,
  updated_at
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'email', 'admin@valhalla.gg'
  )::jsonb,
  'email',
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
) on conflict (id) do nothing;

-- Ensure profile exists for seeded user
insert into public.profiles (id, email, display_name)
values (
  '11111111-1111-1111-1111-111111111111',
  'admin@valhalla.gg',
  'Ayla Stormborn'
)
on conflict (id) do nothing;

insert into public.guilds (id, name, tag, description)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Valhalla',
  'VAL',
  'Elite raiding guild focused on mythic clears.'
)
on conflict (id) do nothing;

insert into public.guild_user_roles (guild_id, user_id, role)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'guild_admin'
)
on conflict (guild_id, user_id) do update set role = excluded.role;

insert into public.members (
  id,
  guild_id,
  user_id,
  in_game_name,
  role_in_guild,
  join_date,
  contact,
  notes
) values
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Ayla',
  'leader',
  current_date - interval '180 days',
  jsonb_build_object('discord', 'ayla#1234'),
  'Guild founder and primary strategist.'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  null,
  'Brynn',
  'officer',
  current_date - interval '120 days',
  jsonb_build_object('discord', 'brynn#5678'),
  'Officer in charge of loot distribution.'
)
on conflict (id) do nothing;

insert into public.transactions (
  id,
  guild_id,
  created_by,
  tx_type,
  category,
  amount,
  description,
  confirmed
) values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'income',
  'guild_donations',
  500.00,
  'Weekly donations from members.',
  true
) on conflict (id) do nothing;

update public.transactions
  set confirmed = true,
      confirmed_by = '11111111-1111-1111-1111-111111111111',
      confirmed_at = timezone('utc', now())
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

insert into public.transactions (
  id,
  guild_id,
  created_by,
  tx_type,
  category,
  amount,
  description,
  confirmed
) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'expense',
  'consumables',
  250.00,
  'Flask and potion restock.',
  false
) on conflict (id) do nothing;

insert into public.loot_records (
  id,
  guild_id,
  boss_name,
  item_name,
  item_rarity,
  estimated_value,
  notes
) values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Skorvald the Shattered',
  'Celestial Greatsword',
  'legendary',
  900.00,
  'Dropped during mythic raid week 12.'
) on conflict (id) do nothing;

insert into public.loot_distribution (
  id,
  loot_id,
  member_id,
  share_amount
) values
(
  '12345678-1234-1234-1234-1234567890ab',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  500.00
),
(
  '12345678-1234-1234-1234-1234567890ac',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  300.00
)
on conflict (id) do nothing;

update public.loot_records
  set distributed = true,
      distributed_at = timezone('utc', now())
where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

insert into public.audit_logs (guild_id, user_id, action, payload)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'seed',
  jsonb_build_object('message', 'Initial dataset loaded.')
);

-- Storage bucket seed (requires supabase storage schema)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  104857600,
  array['image/png', 'image/jpeg', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

commit;
