-- friend_code is UNIQUE and was a single 8-hex-char draw (~4.3e9 space).
-- By the birthday bound that collides with ~1% probability at 10k players and
-- ~70% at 100k — and a collision raised inside get_garden_state, i.e. the new
-- player could never load their garden. Retry on conflict instead.
create or replace function public.new_friend_code()
returns text language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  for i in 1..12 loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    if not exists (select 1 from profiles where friend_code = v_code) then
      return v_code;
    end if;
  end loop;
  -- fall back to a wider code rather than failing the player's first load
  return upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
end $$;

-- get_garden_state now calls new_friend_code() in place of the inline draw.
-- (Full body re-applied in migration 0005 on the remote project.)

-- leaderboards will scan plants by user and care_logs by date every few minutes
create index if not exists plants_active_user_idx on public.plants (user_id) where active;
create index if not exists care_logs_date_action_idx on public.care_logs (care_date, action);

revoke all on function public.new_friend_code() from public, anon, authenticated;
