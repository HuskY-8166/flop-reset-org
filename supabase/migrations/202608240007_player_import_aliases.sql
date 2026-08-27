-- PREPARED ONLY. Do not apply without reviewing the target player rows.
-- These exact Ballchasing identities were confirmed by the V2.2.5 brief;
-- the importer intentionally does not hardcode them in application code.

begin;

update public.players
set aliases = (
  select array_agg(distinct value order by value)
  from unnest(coalesce(aliases, '{}'::text[]) || array['AkTION']) as value
)
where name = 'aktionrl';

update public.players
set aliases = (
  select array_agg(distinct value order by value)
  from unnest(coalesce(aliases, '{}'::text[]) || array['Drollotov']) as value
)
where name = 'droll';

update public.players
set aliases = (
  select array_agg(distinct value order by value)
  from unnest(coalesce(aliases, '{}'::text[]) || array['HuskY.G2']) as value
)
where name = 'HuskY';

do $$
begin
  if not exists (
    select 1 from public.players
    where name = 'aktionrl' and 'AkTION' = any(aliases)
  ) or not exists (
    select 1 from public.players
    where name = 'droll' and 'Drollotov' = any(aliases)
  ) or not exists (
    select 1 from public.players
    where name = 'HuskY' and 'HuskY.G2' = any(aliases)
  ) then
    raise exception 'One or more verified import aliases could not be attached; rolling back.';
  end if;
end $$;

commit;
