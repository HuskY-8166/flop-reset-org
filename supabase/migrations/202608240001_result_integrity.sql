-- PREPARED ONLY: review in a non-production branch before applying.
-- Establishes the explicit result field used by the application. A forfeit
-- result must never be inferred from its public 0-0 score.

alter table public.matches
  add column if not exists result_override text;

alter table public.matches
  add constraint matches_result_override_valid
  check (
    (is_forfeit is true and result_override in ('win', 'loss'))
    or (coalesce(is_forfeit, false) is false and result_override is null)
  ) not valid;

comment on column public.matches.result_override is
  'Flop Reset-perspective result for a forfeit. Never infer performance goals from this field.';

-- Run only after every historical forfeit has an operator-verified result and
-- a 0-0 stored score:
-- alter table public.matches validate constraint matches_result_override_valid;

alter table public.series
  add constraint series_best_of_positive_odd
  check (best_of is null or (best_of > 0 and best_of % 2 = 1)) not valid;
