set
    search_path to public;

-- Enable RLS
alter table
    public.profiles enable row level security;

alter table
    public.guilds enable row level security;

alter table
    public.guild_user_roles enable row level security;

alter table
    public.members enable row level security;

alter table
    public.transactions enable row level security;

alter table
    public.loot_records enable row level security;

alter table
    public.loot_distribution enable row level security;

alter table
    public.audit_logs enable row level security;

-- Profiles
create policy profiles_select_self_or_guild on public.profiles for
select
    using (
        auth.uid() = id
        or exists (
            select
                1
            from
                public.guild_user_roles gur
                join public.members m on m.guild_id = gur.guild_id
                and m.user_id = public.profiles.id
            where
                gur.user_id = auth.uid()
                and gur.role in ('guild_admin', 'officer')
        )
    );

create policy profiles_update_self on public.profiles for
update
    using (auth.uid() = id) with check (auth.uid() = id);

-- Guilds
create policy guilds_select_members on public.guilds for
select
    using (public.user_in_guild(id));

create policy guilds_manage_admin on public.guilds for all using (public.user_has_min_role(id, 'guild_admin')) with check (public.user_has_min_role(id, 'guild_admin'));

-- Guild user roles
create policy guild_user_roles_select on public.guild_user_roles for
select
    using (
        auth.uid() = user_id
        or public.user_has_min_role(guild_id, 'officer')
    );

create policy guild_user_roles_manage on public.guild_user_roles for all using (
    public.user_has_min_role(guild_id, 'officer')
) with check (
    public.user_has_min_role(guild_id, 'officer')
);

-- Members
create policy members_select on public.members for
select
    using (public.user_in_guild(guild_id));

create policy members_modify on public.members for
insert
    with check (public.user_has_min_role(guild_id, 'officer'));

create policy members_update on public.members for
update
    using (public.user_has_min_role(guild_id, 'officer')) with check (public.user_has_min_role(guild_id, 'officer'));

create policy members_delete on public.members for delete using (public.user_has_min_role(guild_id, 'officer'));

-- Transactions
create policy transactions_select on public.transactions for
select
    using (public.user_in_guild(guild_id));

create policy transactions_insert on public.transactions for
insert
    with check (
        public.user_has_any_role(
            guild_id,
            array ['guild_admin','officer']
        )
    );

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

create policy transactions_confirm on public.transactions for
update
    using (public.user_has_min_role(guild_id, 'officer')) with check (
        public.user_has_min_role(guild_id, 'officer')
        and (
            not confirmed
            or confirmed_by = auth.uid()
        )
    );

create policy transactions_delete on public.transactions for delete using (
    public.user_has_min_role(guild_id, 'officer')
);

-- Loot records
create policy loot_records_select on public.loot_records for
select
    using (public.user_in_guild(guild_id));

create policy loot_records_modify on public.loot_records for all using (public.user_has_min_role(guild_id, 'raider')) with check (public.user_has_min_role(guild_id, 'raider'));

-- Loot distribution
create policy loot_distribution_select on public.loot_distribution for
select
    using (
        public.user_in_guild(
            (
                select
                    lr.guild_id
                from
                    public.loot_records lr
                where
                    lr.id = loot_distribution.loot_id
            )
        )
    );

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

