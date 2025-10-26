set search_path to public;

-- Enable RLS on guild_invites
alter table public.guild_invites enable row level security;

-- Helper to determine super admin based on profile app_role
create or replace function public.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
as $func$
  select coalesce(
    (
      select app_role = 'super_admin'
      from public.profiles
      where id = coalesce(p_user_id, auth.uid())
    ),
    false
  );
$func$;

-- Update role priority to account for super admin
create or replace function public.user_role_priority(role_in public.user_role)
returns integer
language sql
immutable
as $func$
  select case role_in::text
    when 'super_admin' then 900
    when 'guild_admin' then 500
    when 'officer'     then 400
    when 'raider'      then 300
    when 'member'      then 200
    when 'viewer'      then 100
    else 0
  end;
$func$;

-- user_in_guild with super admin override
create or replace function public.user_in_guild(p_guild_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin(auth.uid()) then
    return true;
  end if;

  return exists (
    select 1
    from public.guild_user_roles gur
    where gur.guild_id = p_guild_id
      and gur.user_id  = auth.uid()
      and gur.revoked_at is null
  );
end;
$func$;

-- user_has_any_role with super admin override
create or replace function public.user_has_any_role(
  p_guild_id uuid,
  roles_to_check public.user_role[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_found boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin(auth.uid()) then
    return true;
  end if;

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id  = auth.uid()
    and gur.revoked_at is null
    and gur.role     = any(roles_to_check)
  limit 1;

  return coalesce(v_found, false);
end;
$func$;

create or replace function public.user_has_any_role(
  p_guild_id uuid,
  roles_to_check text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_found boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin(auth.uid()) then
    return true;
  end if;

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id  = auth.uid()
    and gur.revoked_at is null
    and gur.role     = any(roles_to_check::public.user_role[])
  limit 1;

  return coalesce(v_found, false);
end;
$func$;

-- user_has_min_role with super admin override
create or replace function public.user_has_min_role(
  p_guild_id uuid,
  min_role public.user_role
)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_found boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin(auth.uid()) then
    return true;
  end if;

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id  = auth.uid()
    and gur.revoked_at is null
    and public.user_role_priority(gur.role) >= public.user_role_priority(min_role)
  limit 1;

  return coalesce(v_found, false);
end;
$func$;

create or replace function public.user_has_min_role(
  p_guild_id uuid,
  min_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
begin
  return public.user_has_min_role(p_guild_id, min_role::public.user_role);
exception
  when undefined_object then
    return false;
  when invalid_text_representation then
    return false;
end;
$func$;

-- Guild invites policies
drop policy if exists guild_invites_select on public.guild_invites;
create policy guild_invites_select on public.guild_invites
  for select
  using (
    public.is_super_admin(auth.uid())
    or public.user_has_min_role(guild_id, 'guild_admin')
  );

drop policy if exists guild_invites_manage on public.guild_invites;
create policy guild_invites_manage on public.guild_invites
  for all
  using (
    public.is_super_admin(auth.uid())
    or public.user_has_min_role(guild_id, 'guild_admin')
  )
  with check (
    public.is_super_admin(auth.uid())
    or public.user_has_min_role(guild_id, 'guild_admin')
  );

-- Audit log policies
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select
  using (
    public.is_super_admin(auth.uid())
    or (
      guild_id is not null
      and public.user_in_guild(guild_id)
    )
  );
