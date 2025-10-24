set
    search_path to public;

-- profiles (mirror auth.users)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text unique,
    display_name text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_idx on public.profiles (email);

-- guilds
create table if not exists public.guilds (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    tag text not null,
    description text,
    balance numeric(14, 2) not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- roles mapping
create table if not exists public.guild_user_roles (
    guild_id uuid not null references public.guilds (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    role public.user_role not null,
    created_at timestamptz not null default timezone('utc', now()),
    primary key (guild_id, user_id)
);

create index if not exists guild_user_roles_user_guild_idx on public.guild_user_roles (user_id, guild_id);

-- members roster
create table if not exists public.members (
    id uuid primary key default gen_random_uuid(),
    guild_id uuid not null references public.guilds (id) on delete cascade,
    user_id uuid references public.profiles (id),
    in_game_name text not null,
    role_in_guild public.guild_role not null,
    join_date date,
    contact jsonb not null default '{}' :: jsonb,
    notes text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists members_guild_active_idx on public.members (guild_id, is_active);

-- transactions
create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    guild_id uuid not null references public.guilds (id) on delete cascade,
    created_by uuid not null references public.profiles (id),
    tx_type public.tx_type not null,
    category text not null,
    amount numeric(14, 2) not null check (amount >= 0),
    description text,
    evidence_path text,
    confirmed boolean not null default false,
    confirmed_by uuid references public.profiles (id),
    confirmed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists transactions_guild_created_idx on public.transactions (guild_id, created_at desc);

-- loot_records
create table if not exists public.loot_records (
    id uuid primary key default gen_random_uuid(),
    guild_id uuid not null references public.guilds (id) on delete cascade,
    boss_name text,
    item_name text not null,
    item_rarity public.rarity not null,
    estimated_value numeric(14, 2) not null check (estimated_value >= 0),
    distributed boolean not null default false,
    distributed_at timestamptz,
    notes text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists loot_records_guild_created_idx on public.loot_records (guild_id, created_at desc);

-- loot_distribution
create table if not exists public.loot_distribution (
    id uuid primary key default gen_random_uuid(),
    loot_id uuid not null references public.loot_records (id) on delete cascade,
    member_id uuid not null references public.members (id) on delete cascade,
    share_amount numeric(14, 2) not null check (share_amount >= 0),
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists loot_distribution_unique_member on public.loot_distribution (loot_id, member_id);

-- audit_logs
create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    guild_id uuid not null references public.guilds (id) on delete cascade,
    user_id uuid references public.profiles (id),
    action text not null,
    payload jsonb not null default '{}' :: jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_guild_created_idx on public.audit_logs (guild_id, created_at desc);