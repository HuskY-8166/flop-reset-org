-- PREPARED ONLY: review in a non-production branch before applying.
-- Establishes an explicit forfeit result while preserving the legacy score
-- encoding as a reversible compatibility fallback.

alter table public.matches
  add column if not exists forfeit_result text;

alter table public.matches
  add constraint matches_forfeit_result_valid
  check (
    (is_forfeit is true and forfeit_result in ('win', 'loss'))
    or (coalesce(is_forfeit, false) is false and forfeit_result is null)
  ) not valid;

comment on column public.matches.forfeit_result is
  'Flop Reset-perspective result for a forfeit. Never infer performance goals from this field.';

-- Compatibility bridge for the current Admin release. This lets legacy 1-0 /
-- 0-1 writes receive the explicit value inside Postgres while the public app
-- stops treating that score as performance. Remove the trigger after every
-- writer sends forfeit_result directly.
create or replace function public.populate_legacy_forfeit_result()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_forfeit, false) is false then
    new.forfeit_result := null;
  elsif new.forfeit_result is null then
    new.forfeit_result := case
      when new.flop_reset_score > new.opponent_score then 'win'
      when new.flop_reset_score < new.opponent_score then 'loss'
      else null
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists matches_populate_legacy_forfeit_result on public.matches;
create trigger matches_populate_legacy_forfeit_result
before insert or update of is_forfeit, forfeit_result, flop_reset_score, opponent_score
on public.matches
for each row execute function public.populate_legacy_forfeit_result();

-- Backfill the known legacy convention. Ambiguous 0-0 forfeits remain NULL and
-- will intentionally fail validation until reviewed by a human.
update public.matches
set forfeit_result = case
  when flop_reset_score > opponent_score then 'win'
  when flop_reset_score < opponent_score then 'loss'
  else null
end
where is_forfeit is true
  and forfeit_result is null;

-- Run only after ambiguous rows have been reviewed:
-- alter table public.matches validate constraint matches_forfeit_result_valid;

alter table public.series
  add constraint series_best_of_positive_odd
  check (best_of is null or (best_of > 0 and best_of % 2 = 1)) not valid;
