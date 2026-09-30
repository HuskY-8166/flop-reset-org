-- FLOP RESET V2.4 — FUTURE CURRENT TEAM IDENTITY
--
-- Focused, non-destructive lifecycle update:
--   * Frantic remains the same canonical team and keeps every historical FK.
--   * Future receives a new canonical team identity with no inherited history.
--   * No roster, competition entry, result, stat, Power row, or source ID is invented.

begin;

do $$
declare
  future_id bigint;
begin
  if not exists (
    select 1
    from public.teams
    where lower(name) = 'frantic'
      and format = '3v3'
  ) then
    raise exception 'Expected canonical Frantic 3v3 team was not found; refusing lifecycle update.';
  end if;

  update public.teams
  set active = false
  where lower(name) = 'frantic'
    and format = '3v3';

  insert into public.teams (
    name,
    format,
    captain,
    display_name,
    short_name,
    slug,
    primary_color,
    secondary_color,
    logo_url,
    wordmark_style,
    active,
    brand_metadata
  )
  values (
    'Future',
    '3v3',
    null,
    'Future',
    'Future',
    'future',
    '#FF00A6',
    '#BCBAB7',
    null,
    'light',
    true,
    jsonb_build_object(
      'full_name', 'Flop Reset Future',
      'supporting_color', '#FFFFFF',
      'theme', 'light-grey-white-pink'
    )
  )
  on conflict (name, format) do update
  set display_name = excluded.display_name,
      short_name = excluded.short_name,
      slug = excluded.slug,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      wordmark_style = excluded.wordmark_style,
      active = true,
      brand_metadata = excluded.brand_metadata
  returning id into future_id;

  if future_id is null then
    select id into future_id
    from public.teams
    where name = 'Future'
      and format = '3v3';
  end if;

  if exists (select 1 from public.series where flop_reset_team_id = future_id)
     or exists (select 1 from public.matches where flop_reset_team_id = future_id)
     or exists (select 1 from public.players where team_id = future_id)
     or exists (select 1 from public.player_team_memberships where team_id = future_id)
     or exists (select 1 from public.competition_entries where fr_team_id = future_id)
     or exists (select 1 from public.scheduled_matches where flop_reset_team_id = future_id)
     or exists (
       select 1
       from public.playoff_matches
       where flop_reset_team_a_id = future_id
          or flop_reset_team_b_id = future_id
     )
     or exists (
       select 1
       from public.team_rating_snapshots
       where lower(team_name_snapshot) in ('future', 'flop reset future')
     ) then
    raise exception 'Future already has competitive or roster data; refusing to treat this as a clean identity bootstrap.';
  end if;
end $$;

commit;

select id, name, format, active, display_name, short_name, slug,
       primary_color, secondary_color, wordmark_style, brand_metadata
from public.teams
where (lower(name) = 'frantic' and format = '3v3')
   or (name = 'Future' and format = '3v3')
order by id;
