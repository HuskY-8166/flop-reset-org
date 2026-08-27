-- PREPARED ONLY. Review in a Supabase branch before production.
-- The playoff graph tables already exist. This migration adds the participant
-- and public-result fields missing from the live schema; it does not create a
-- competing bracket model or seed any unverified playoff entries.

alter table public.playoff_matches add column if not exists team_a_name text;
alter table public.playoff_matches add column if not exists team_b_name text;
alter table public.playoff_matches add column if not exists score_a integer;
alter table public.playoff_matches add column if not exists score_b integer;
alter table public.playoff_matches add column if not exists winner_name text;
alter table public.playoff_matches add column if not exists best_of integer;
alter table public.playoff_matches add column if not exists is_forfeit boolean not null default false;
alter table public.playoff_matches add column if not exists flop_reset_team_a_id bigint references public.teams(id);
alter table public.playoff_matches add column if not exists flop_reset_team_b_id bigint references public.teams(id);
alter table public.playoff_matches add column if not exists opponent_a_id bigint references public.opponents(opponent_id);
alter table public.playoff_matches add column if not exists opponent_b_id bigint references public.opponents(opponent_id);

create index if not exists playoff_matches_bracket_round_idx
  on public.playoff_matches(bracket_id, round_name, match_order);
create index if not exists playoff_matches_series_id_idx
  on public.playoff_matches(series_id);
create index if not exists playoff_matches_scheduled_match_id_idx
  on public.playoff_matches(scheduled_match_id);

alter table public.playoff_matches
  add constraint playoff_matches_scores_nonnegative
  check ((score_a is null or score_a >= 0) and (score_b is null or score_b >= 0)) not valid;

alter table public.playoff_matches
  add constraint playoff_bye_has_no_competitive_result
  check (
    coalesce(is_bye, false) is false
    or (
      series_id is null
      and scheduled_match_id is null
      and score_a is null
      and score_b is null
    )
  ) not valid;

alter table public.playoff_matches
  add constraint playoff_matches_best_of_positive_odd
  check (best_of is null or (best_of > 0 and best_of % 2 = 1)) not valid;

alter table public.playoff_matches
  add constraint playoff_participant_identity_exclusive
  check (
    not (flop_reset_team_a_id is not null and opponent_a_id is not null)
    and not (flop_reset_team_b_id is not null and opponent_b_id is not null)
  ) not valid;

alter table public.playoff_matches
  add constraint playoff_bye_is_not_forfeit
  check (coalesce(is_bye, false) is false or coalesce(is_forfeit, false) is false) not valid;

alter table public.playoff_matches enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'playoff_matches' and policyname = 'playoff_matches_public_read'
  ) then
    create policy playoff_matches_public_read on public.playoff_matches for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'playoff_matches' and policyname = 'playoff_matches_admin_write'
  ) then
    create policy playoff_matches_admin_write on public.playoff_matches for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true)
      with check ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true);
  end if;
end $$;

alter table public.playoff_brackets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'playoff_brackets' and policyname = 'playoff_brackets_public_read'
  ) then
    create policy playoff_brackets_public_read on public.playoff_brackets for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'playoff_brackets' and policyname = 'playoff_brackets_admin_write'
  ) then
    create policy playoff_brackets_admin_write on public.playoff_brackets for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true)
      with check ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true);
  end if;
end $$;

comment on column public.playoff_matches.team_a_name is 'Historical participant snapshot. Never rewrite after the competition is archived.';
comment on column public.playoff_matches.team_b_name is 'Historical participant snapshot. BYE is represented by is_bye, not a fake opponent or match.';
comment on column public.playoff_matches.winner_name is 'Manual/external winner snapshot. A linked Flop Reset series remains the result source of truth.';
comment on column public.playoff_matches.is_forfeit is 'Bracket-level forfeit flag. FR statistical W/L must come from a linked zero-game series.';

-- Do not seed Tier 4/5/6 from the draft brief alone. Import only after the
-- official Summer Circuit bracket source has been verified by an operator.
