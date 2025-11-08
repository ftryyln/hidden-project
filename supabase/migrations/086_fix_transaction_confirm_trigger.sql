set search_path to public;

create or replace function public.on_transaction_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if (old.confirmed is distinct from true) and new.confirmed = true then
    insert into public.audit_logs (guild_id, actor_user_id, action, metadata)
    values (
      new.guild_id,
      coalesce(new.confirmed_by, auth.uid()),
      'TRANSACTION_CONFIRMED',
      jsonb_build_object(
        'transaction_id', new.id,
        'confirmed_by',   new.confirmed_by,
        'confirmed_at',   new.confirmed_at
      )
    );
  end if;
  return new;
end;
$func$;

drop trigger if exists transactions_on_confirm on public.transactions;
create trigger transactions_on_confirm
  after update of confirmed on public.transactions
  for each row
  when (old.confirmed is distinct from true and new.confirmed = true)
  execute function public.on_transaction_confirm();
