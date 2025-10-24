set search_path to public;
set check_function_bodies = off;

-- Priority helper
create or replace function public.user_role_priority(role_in public.user_role)
returns integer
language sql
immutable
as $func$
  select case role_in
    when 'guild_admin' then 400
    when 'officer'     then 300
    when 'member'      then 200
    when 'viewer'      then 100
  end;
$func$;

-- Is current auth user in the guild?
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

  return exists (
    select 1
    from public.guild_user_roles gur
    where gur.guild_id = p_guild_id
      and gur.user_id  = auth.uid()
  );
end;
$func$;

-- Has ANY of the given roles (enum[] version)
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

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id  = auth.uid()
    and gur.role     = any(roles_to_check)
  limit 1;

  return coalesce(v_found, false);
end;
$func$;

-- Overload: accept text[] and cast to enum[] so array['a','b'] works
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

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id  = auth.uid()
    and gur.role     = any(roles_to_check::public.user_role[])
  limit 1;

  return coalesce(v_found, false);
end;
$func$;

-- Has at least a minimum role
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

  select true
    into v_found
  from public.guild_user_roles gur
  where gur.guild_id = p_guild_id
    and gur.user_id  = auth.uid()
    and public.user_role_priority(gur.role) >= public.user_role_priority(min_role)
  limit 1;

  return coalesce(v_found, false);
end;
$func$;

-- Trigger helper to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$func$;

-- Presigned URL helper for Storage
create or replace function public.get_evidence_url(
  p_path text,
  p_expires integer default 3600
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_result jsonb;
begin
  if coalesce(trim(p_path), '') = '' then
    raise exception 'path cannot be empty';
  end if;

  v_result := storage.generate_presigned_url(
    bucket_id   := 'evidence',
    object_name := p_path,
    expires_in  := greatest(coalesce(p_expires, 3600), 60),
    download    := false
  );

  return v_result;
end;
$func$;
