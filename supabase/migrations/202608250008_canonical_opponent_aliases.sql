-- PREPARED ONLY. Do not apply to production without explicit approval.
-- Historical series.opponent_name snapshots remain unchanged.

begin;

do $$
begin
  if not exists (
    select 1 from public.opponents
    where opponent_id = 9 and normalized_name in ('midlads', 'ohio midlads')
  ) then
    raise exception 'Opponent #9 no longer matches the audited MIDLADS identity.';
  end if;

  if not exists (
    select 1 from public.opponents
    where opponent_id = 7 and normalized_name in ('sbc angels', 'sbc blue angels')
  ) then
    raise exception 'Opponent #7 no longer matches the audited SBC Angels identity.';
  end if;
end $$;

update public.opponents
set canonical_name = 'Ohio Midlads', normalized_name = 'ohio midlads'
where opponent_id = 9;

insert into public.opponent_aliases (opponent_id, alias, normalized_alias)
select 9, 'MIDLADS', 'midlads'
where not exists (
  select 1 from public.opponent_aliases
  where opponent_id = 9 and normalized_alias = 'midlads'
);

update public.opponents
set canonical_name = 'SBC Blue Angels', normalized_name = 'sbc blue angels'
where opponent_id = 7;

insert into public.opponent_aliases (opponent_id, alias, normalized_alias)
select 7, 'SBC Angels', 'sbc angels'
where not exists (
  select 1 from public.opponent_aliases
  where opponent_id = 7 and normalized_alias = 'sbc angels'
);

-- Link already canonicalized schedule snapshots without rewriting display copy.
update public.scheduled_matches
set opponent_id = 9
where opponent_id is null
  and lower(trim(opponent_name)) in ('midlads', 'ohio midlads');

update public.scheduled_matches
set opponent_id = 7
where opponent_id is null
  and lower(trim(opponent_name)) in ('sbc angels', 'sbc blue angels');

commit;
