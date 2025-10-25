do $$
declare
  v_email   text := 'kyutofit@gmail.com';
  v_display text := 'Platform Admin';
  -- bcrypt hash untuk password Admin!23
  v_bcrypt  text := '$2a$10$8TXJv0M9Xg8tPzH2kZcV1uRkCXxZg8u8sJ2M6o2yE2mQk2c2o7r6m';
  v_user_id uuid;
begin
  -- Cari user berdasarkan email
  select id into v_user_id
  from auth.users
  where email = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, invited_at, confirmation_sent_at,
      last_sign_in_at, raw_user_meta_data, raw_app_meta_data,
      aud, role, created_at, updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      v_bcrypt,
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object('display_name', v_display),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      'authenticated', 'authenticated',
      timezone('utc', now()), timezone('utc', now())
    );
  else
    update auth.users
    set encrypted_password = v_bcrypt,
        email_confirmed_at = timezone('utc', now()),
        raw_user_meta_data = jsonb_build_object('display_name', v_display),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email']),
        updated_at = timezone('utc', now())
    where id = v_user_id;
  end if;

  -- Upsert identity email
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    created_at, last_sign_in_at, updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    json_build_object('sub', v_user_id::text, 'email', v_email)::jsonb,
    'email',
    v_email,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (provider, provider_id)
  do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = excluded.updated_at;

  -- Pastikan profile & guild roles
  insert into public.profiles (id, email, display_name)
  values (v_user_id, v_email, v_display)
  on conflict (id) do update set email = excluded.email;

  insert into public.guild_user_roles (guild_id, user_id, role)
  select g.id, v_user_id, 'guild_admin'
  from public.guilds g
  on conflict (guild_id, user_id) do update set role = excluded.role;

  if not exists (select 1 from public.guilds) then
    insert into public.guilds (id, name, tag, description)
    values ('11111111-2222-3333-4444-555555555555', 'Main Guild', 'MAIN', 'Default guild for initial admin')
    on conflict do nothing;

    insert into public.guild_user_roles (guild_id, user_id, role)
    values ('11111111-2222-3333-4444-555555555555', v_user_id, 'guild_admin')
    on conflict (guild_id, user_id) do update set role = excluded.role;
  end if;
end
$$;
