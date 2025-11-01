set search_path to public;

-- Extend audit_action enum with admin, transaction, and loot events
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'GUILD_CREATED'
  ) then
    alter type public.audit_action add value 'GUILD_CREATED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'GUILD_UPDATED'
  ) then
    alter type public.audit_action add value 'GUILD_UPDATED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'GUILD_DELETED'
  ) then
    alter type public.audit_action add value 'GUILD_DELETED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'TRANSACTION_CREATED'
  ) then
    alter type public.audit_action add value 'TRANSACTION_CREATED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'TRANSACTION_UPDATED'
  ) then
    alter type public.audit_action add value 'TRANSACTION_UPDATED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'TRANSACTION_DELETED'
  ) then
    alter type public.audit_action add value 'TRANSACTION_DELETED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'LOOT_CREATED'
  ) then
    alter type public.audit_action add value 'LOOT_CREATED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'LOOT_UPDATED'
  ) then
    alter type public.audit_action add value 'LOOT_UPDATED';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.audit_action'::regtype
      and enumlabel = 'LOOT_DELETED'
  ) then
    alter type public.audit_action add value 'LOOT_DELETED';
  end if;
end
$$;

-- Helper for admin guild overview, including membership/admin counts
create or replace function public.admin_list_guilds(p_guild_id uuid default null)
returns table (
  id uuid,
  name text,
  tag text,
  description text,
  created_at timestamptz,
  updated_at timestamptz,
  member_count integer,
  admin_count integer
)
language sql
stable
as $func$
  select
    g.id,
    g.name,
    g.tag,
    g.description,
    g.created_at,
    g.updated_at,
    (
      select count(*)
      from public.members m
      where m.guild_id = g.id
        and coalesce(m.is_active, true)
    )::int as member_count,
    (
      select count(*)
      from public.guild_user_roles gur
      where gur.guild_id = g.id
        and gur.role = 'guild_admin'
        and gur.revoked_at is null
    )::int as admin_count
  from public.guilds g
  where p_guild_id is null
     or g.id = p_guild_id
  order by g.created_at desc;
$func$;
