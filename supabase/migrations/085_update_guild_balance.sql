create or replace function public.guild_current_balance(p_guild_id uuid)
returns numeric
language sql
stable
as $$
  with tx as (
    select coalesce(sum(case when tx_type = 'income' then amount
                              when tx_type = 'expense' then -amount
                              else 0 end), 0)::numeric as total
    from public.transactions
    where guild_id = p_guild_id
      and confirmed = true
  ),
  loot as (
    select coalesce(sum(estimated_value), 0)::numeric as total
    from public.loot_records
    where guild_id = p_guild_id
      and coalesce(distributed, false) = false
  )
  select (select total from tx) + (select total from loot);
$$;