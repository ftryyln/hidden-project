set search_path to public;

-- Profile sync with auth.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do update
    set email        = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at   = timezone('utc', now());
  return new;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_new_auth_user();

-- Prevent unauthorized email change
create or replace function public.enforce_profile_updates()
returns trigger
language plpgsql
as $func$
begin
  if new.email is distinct from old.email then
    raise exception 'email is managed by auth service';
  end if;
  return new;
end;
$func$;

drop trigger if exists profiles_only_display_name on public.profiles;
create trigger profiles_only_display_name
  before update on public.profiles
  for each row execute function public.enforce_profile_updates();

-- updated_at triggers
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists guilds_set_updated_at on public.guilds;
create trigger guilds_set_updated_at
  before update on public.guilds
  for each row execute function public.set_updated_at();

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- Transaction confirm audit
create or replace function public.on_transaction_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if (old.confirmed is distinct from true) and new.confirmed = true then
    insert into public.audit_logs (guild_id, actor_user_id, action, metadata)
    values (
      new.guild_id,
      coalesce(new.confirmed_by, auth.uid()),
      'TRANSACTION_CONFIRMED',
      jsonb_build_object(
        'transaction_id', new.id,
        'confirmed_by',   new.confirmed_by,
        'confirmed_at',   new.confirmed_at
      )
    );
  end if;
  return new;
end;
$func$;

drop trigger if exists transactions_on_confirm on public.transactions;
create trigger transactions_on_confirm
  after update of confirmed on public.transactions
  for each row
  when (old.confirmed is distinct from true and new.confirmed = true)
  execute function public.on_transaction_confirm();

-- Views
create or replace function public.guild_current_balance(p_guild_id uuid)
returns numeric
language sql
stable
as $func$
  select coalesce(
    sum(case when tx_type = 'income' then amount
             when tx_type = 'expense' then -amount
             else 0 end), 0)
  from public.transactions
  where guild_id = p_guild_id
    and confirmed = true;
$func$;

create or replace view public.vw_monthly_summary as
with base as (
  select
    t.guild_id,
    date_trunc('month', t.created_at) as month_bucket,
    sum(case when t.tx_type = 'income'  then t.amount else 0 end) as income_total,
    sum(case when t.tx_type = 'expense' then t.amount else 0 end) as expense_total
  from public.transactions t
  where t.confirmed = true
  group by 1,2
)
select
  guild_id,
  extract(year  from month_bucket)::int as year,
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
  where t.tx_type = 'income' and t.confirmed = true
  group by t.guild_id, t.created_by, p.display_name, p.email
) s;
