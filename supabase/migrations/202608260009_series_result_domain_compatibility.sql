-- SCHEMA ONLY: apply before deploying V2.3.8 if production does not yet have
-- the series-level administrative-forfeit result domain.
--
-- This migration does not delete or reset competitive history.

begin;

alter table public.series
  add column if not exists is_forfeit boolean not null default false;

-- Safely normalize a pre-existing nullable version of the column before
-- enforcing the application contract.
update public.series
set is_forfeit = false
where is_forfeit is null;

alter table public.series
  alter column is_forfeit set default false,
  alter column is_forfeit set not null;

alter table public.series
  add column if not exists result_override text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.series'::regclass
      and conname = 'series_forfeit_result_valid'
  ) then
    alter table public.series
      add constraint series_forfeit_result_valid
      check (
        (is_forfeit is true and result_override in ('win', 'loss'))
        or (is_forfeit is false and result_override is null)
      ) not valid;
  end if;
end $$;

comment on column public.series.is_forfeit is
  'Administrative series result. A forfeit has zero matches and zero player-stat rows.';
comment on column public.series.result_override is
  'Flop Reset-perspective result for a zero-game forfeit: win or loss.';

commit;
