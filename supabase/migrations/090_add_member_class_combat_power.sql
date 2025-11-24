-- Add class and combat_power columns to members table
alter table public.members
  add column if not exists class text,
  add column if not exists combat_power integer;

-- Add index for combat_power for sorting
create index if not exists members_combat_power_idx on public.members (guild_id, combat_power desc nulls last);
