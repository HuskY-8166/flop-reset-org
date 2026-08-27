-- PREPARED ONLY. Do not apply without a backup and review of
-- docs/COMPETITION_DATA_INTEGRITY_REPORT_2026-08-24.md.

do $$
declare
  source_format text;
  target_format text;
  mismatched_count integer;
begin
  select format into source_format from public.competitions where id = 1;
  select format into target_format from public.competitions where id = 2;

  if source_format is distinct from '2v2' or target_format is distinct from '3v3' then
    raise exception 'Competition formats changed since the audit; aborting repair.';
  end if;

  select count(*) into mismatched_count
  from public.series s
  join public.teams t on t.id = s.flop_reset_team_id
  where s.series_id = any(array[16,17,18,20,21,22,23,25,26,27,28,29,30,31])
    and s.competition_id = 1
    and t.format = '3v3';

  if mismatched_count <> 14 then
    raise exception 'Expected 14 audited series, found %; aborting repair.', mismatched_count;
  end if;
end $$;

begin;

update public.matches
set competition_id = 2
where series_id = any(array[16,17,18,20,21,22,23,25,26,27,28,29,30,31])
  and competition_id = 1;

update public.series
set competition_id = 2
where series_id = any(array[16,17,18,20,21,22,23,25,26,27,28,29,30,31])
  and competition_id = 1;

do $$
begin
  if exists (
    select 1
    from public.series s
    join public.competitions c on c.id = s.competition_id
    join public.teams t on t.id = s.flop_reset_team_id
    where s.series_id = any(array[16,17,18,20,21,22,23,25,26,27,28,29,30,31])
      and c.format is distinct from t.format
  ) then
    raise exception 'Format mismatch remains after repair; rolling back.';
  end if;
end $$;

commit;
