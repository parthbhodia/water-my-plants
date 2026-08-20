-- Hairstyles join the avatar: 0 cropped, 1 long, 2 ponytail, 3 buns.
-- clean_avatar is the write-side whitelist, so the new key must pass it.
create or replace function public.clean_avatar(a jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'skin',   greatest(0, least(15, coalesce((a->>'skin')::int, 0))),
    'hair',   greatest(0, least(15, coalesce((a->>'hair')::int, 0))),
    'hairdo', greatest(0, least(15, coalesce((a->>'hairdo')::int, 0))),
    'hat',    greatest(0, least(15, coalesce((a->>'hat')::int, 0))),
    'outfit', greatest(0, least(15, coalesce((a->>'outfit')::int, 0)))
  )
$$;
