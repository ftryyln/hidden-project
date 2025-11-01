set search_path to public;

-- Recreate the foreign key hint used by PostgREST for actor profile lookups.
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'audit_logs_actor_user_id_fkey'
      and table_schema = 'public'
      and table_name = 'audit_logs'
  ) then
    alter table public.audit_logs
      drop constraint audit_logs_actor_user_id_fkey;
  end if;
end
$$;

alter table public.audit_logs
  add constraint audit_logs_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles (id);

-- Ensure idx exists for join performance (optional but helpful).
create index if not exists audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id);
