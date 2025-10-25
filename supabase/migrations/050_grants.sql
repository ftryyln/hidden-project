-- 050_grants.sql (bersih & lengkap)

set search_path to public;

-- === Function EXECUTE grants (sekali saja, tanpa duplikat) ===
grant execute on function public.user_in_guild(uuid)                          to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.user_has_min_role(uuid, public.user_role)    to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.user_has_any_role(uuid, public.user_role[])  to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.user_has_any_role(uuid, text[])              to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.user_role_priority(public.user_role)         to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_evidence_url(text, integer)              to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.handle_new_auth_user()                       to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.enforce_profile_updates()                    to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.set_updated_at()                             to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.on_transaction_confirm()                     to anon, authenticated, service_role, supabase_auth_admin;

-- === Schema usage (penting untuk PostgREST bisa introspect) ===
grant usage on schema public  to anon, authenticated, supabase_auth_admin;
grant usage on schema storage to anon, authenticated, supabase_auth_admin;

-- === Tabel / view / sequence di schema public (tetap di-protect RLS) ===
grant select, insert, update, delete on all tables in schema public to anon, authenticated, supabase_auth_admin;
grant usage, select on all sequences in schema public to anon, authenticated, supabase_auth_admin;

-- Default privileges untuk objek BARU di schema public
alter default privileges in schema public grant
  select, insert, update, delete on tables to anon, authenticated, supabase_auth_admin;
alter default privileges in schema public grant
  usage, select on sequences to anon, authenticated, supabase_auth_admin;

-- (Opsional) Storage: ini bisa gagal “must be owner” di hosted Supabase; aman diabaikan.
grant select on storage.buckets to anon, authenticated, supabase_auth_admin;
grant select, insert, update, delete on storage.objects to anon, authenticated, supabase_auth_admin;
