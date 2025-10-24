-- SEED: create first platform admin and promote to guild_admin on all guilds
-- Catatan:
-- - Ganti v_user_id, v_email, v_bcrypt sesuai kebutuhanmu.
-- - v_bcrypt di bawah adalah hash untuk password: Admin!23

do $$
declare
  -- 👉 GANTI SESUAI KEBUTUHANMU
  v_user_id uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;  -- fixed UUID untuk admin pertama
  v_email   text := 'kyutofit@gmail.com';                         -- email admin pertama

  -- bcrypt('Admin!23')
  v_bcrypt  text := '$2a$10$8TXJv0M9Xg8tPzH2kZcV1uRkCXxZg8u8sJ2M6o2yE2mQk2c2o7r6m';
begin
  ---------------------------------------------------------------------------
  -- 1) Buat user di auth.users (email confirmed)
  ---------------------------------------------------------------------------
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_sent_at, recovery_sent_at,
    last_sign_in_at, raw_user_meta_data, raw_app_meta_data, aud, role,
    created_at, updated_at
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_bcrypt,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now()),
    null,
    timezone('utc', now()),
    jsonb_build_object('display_name','Platform Admin'),
    jsonb_build_object('provider','email','providers', array['email']),
    'authenticated','authenticated',
    timezone('utc', now()), timezone('utc', now())
  )
  on conflict (id) do nothing;

  ---------------------------------------------------------------------------
  -- 2) Buat identity untuk provider 'email'
  --    Wajib isi provider_id (untuk provider 'email' = alamat email)
  --    Pakai upsert idempotent berdasarkan (provider, provider_id).
  ---------------------------------------------------------------------------
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    last_sign_in_at,
    updated_at
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
  on conflict (provider, provider_id) do update
    set user_id       = excluded.user_id,
        identity_data = excluded.identity_data,
        updated_at    = excluded.updated_at;

  ---------------------------------------------------------------------------
  -- 3) Pastikan profile ada (trigger handle_new_auth_user juga akan mengisi)
  ---------------------------------------------------------------------------
  insert into public.profiles (id, email, display_name)
  values (v_user_id, v_email, 'Platform Admin')
  on conflict (id) do update
    set email = excluded.email;

  ---------------------------------------------------------------------------
  -- 4) Promote admin sebagai guild_admin di SEMUA guild yang sudah ada
  ---------------------------------------------------------------------------
  insert into public.guild_user_roles (guild_id, user_id, role)
  select g.id, v_user_id, 'guild_admin'::public.user_role
  from public.guilds g
  on conflict (guild_id, user_id) do update set role = excluded.role;

  ---------------------------------------------------------------------------
  -- 5) Jika belum ada guild sama sekali, buat default lalu promote
  ---------------------------------------------------------------------------
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
