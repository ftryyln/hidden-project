set
    search_path to public;

-- Extend user_role enum with the raider role if it does not exist yet.
do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.user_role'::regtype
      and enumlabel = 'raider'
  ) then
    alter type public.user_role add value 'raider' after 'officer';
  end if;
end
$$;

-- Refresh the role priority helper to include the raider role.
create or replace function public.user_role_priority(role_in public.user_role)
returns integer
language sql
immutable
as $func$
  select case role_in
    when 'guild_admin' then 500
    when 'officer'     then 400
    when 'raider'      then 300
    when 'member'      then 200
    when 'viewer'      then 100
  end;
$func$;

-- Members can only be managed by guild admins.
drop policy if exists members_modify on public.members;
create policy members_modify on public.members for
insert
    with check (public.user_has_min_role(guild_id, 'guild_admin'));

drop policy if exists members_update on public.members;
create policy members_update on public.members for
update
    using (public.user_has_min_role(guild_id, 'guild_admin'))
    with check (public.user_has_min_role(guild_id, 'guild_admin'));

drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete using (public.user_has_min_role(guild_id, 'guild_admin'));

-- Transactions can be managed by guild admins and officers only.
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for
insert
    with check (
        public.user_has_any_role(
            guild_id,
            array ['guild_admin','officer']
        )
    );

drop policy if exists transactions_update_draft on public.transactions;
create policy transactions_update_draft on public.transactions for
update
    using (
        public.user_has_any_role(
            guild_id,
            array ['guild_admin','officer']
        )
        and auth.uid() = created_by
        and confirmed = false
    ) with check (
        public.user_has_any_role(
            guild_id,
            array ['guild_admin','officer']
        )
        and auth.uid() = created_by
        and confirmed = false
    );

drop policy if exists transactions_confirm on public.transactions;
create policy transactions_confirm on public.transactions for
update
    using (public.user_has_min_role(guild_id, 'officer')) with check (
        public.user_has_min_role(guild_id, 'officer')
        and (
            not confirmed
            or confirmed_by = auth.uid()
        )
    );

-- Loot management extends to raider role.
drop policy if exists loot_records_modify on public.loot_records;
create policy loot_records_modify on public.loot_records for all using (public.user_has_min_role(guild_id, 'raider')) with check (public.user_has_min_role(guild_id, 'raider'));

drop policy if exists loot_distribution_modify on public.loot_distribution;
create policy loot_distribution_modify on public.loot_distribution for all using (
    public.user_has_min_role(
        (
            select
                lr.guild_id
            from
                public.loot_records lr
            where
                lr.id = loot_distribution.loot_id
        ),
        'raider'
    )
) with check (
    public.user_has_min_role(
        (
            select
                lr.guild_id
            from
                public.loot_records lr
            where
                lr.id = loot_distribution.loot_id
        ),
        'raider'
    )
);
