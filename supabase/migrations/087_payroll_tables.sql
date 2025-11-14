set search_path to public;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payroll_source') then
    create type public.payroll_source as enum ('TRANSACTION', 'LOOT');
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payroll_mode') then
    create type public.payroll_mode as enum ('EQUAL', 'PERCENTAGE', 'FIXED');
  end if;
end;
$$;

create table if not exists public.payroll_batches (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds (id) on delete cascade,
  reference_code text unique,
  source public.payroll_source not null,
  mode public.payroll_mode not null,
  period_from date,
  period_to date,
  total_amount numeric(18, 2) not null check (total_amount >= 0),
  notes text,
  distributed_by_user_id uuid not null references public.profiles (id),
  distributed_by_name text not null,
  balance_before numeric(18, 2) not null,
  balance_after numeric(18, 2) not null,
  members_count integer not null default 0 check (members_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_batches_period_range check (
    period_from is null
    or period_to is null
    or period_to >= period_from
  )
);

create index if not exists payroll_batches_guild_created_idx
  on public.payroll_batches (guild_id, created_at desc);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payroll_batches (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  amount numeric(18, 2) not null check (amount >= 0),
  percentage numeric(9, 4),
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_items_percentage_check check (
    percentage is null or percentage >= 0
  )
);

create unique index if not exists payroll_items_batch_member_uniq
  on public.payroll_items (batch_id, member_id);

create index if not exists payroll_items_member_idx
  on public.payroll_items (member_id);

create index if not exists payroll_items_batch_idx
  on public.payroll_items (batch_id);

drop trigger if exists payroll_batches_set_updated_at on public.payroll_batches;
create trigger payroll_batches_set_updated_at
  before update on public.payroll_batches
  for each row
  execute function public.set_updated_at();

create or replace function public.payroll_sum_confirmed_income(p_guild_id uuid)
returns numeric
language sql
security definer
set search_path = public
as $func$
  select coalesce(sum(t.amount), 0)
  from public.transactions t
  where t.guild_id = p_guild_id
    and t.tx_type = 'income'
    and t.confirmed = true;
$func$;

create or replace function public.payroll_sum_loot_value(p_guild_id uuid)
returns numeric
language sql
security definer
set search_path = public
as $func$
  select coalesce(sum(l.estimated_value), 0)
  from public.loot_records l
  where l.guild_id = p_guild_id;
$func$;

create or replace function public.payroll_sum_disbursed(
  p_guild_id uuid,
  p_source public.payroll_source
)
returns numeric
language sql
security definer
set search_path = public
as $func$
  select coalesce(sum(pi.amount), 0)
  from public.payroll_items pi
  join public.payroll_batches pb on pb.id = pi.batch_id
  where pb.guild_id = p_guild_id
    and pb.source = p_source;
$func$;
