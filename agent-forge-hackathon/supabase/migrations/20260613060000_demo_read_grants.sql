grant usage on schema public to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'calls',
    'transcript_segments',
    'transcript_partials',
    'risk_signals',
    'evidence_moments',
    'recordings',
    'jobs',
    'media_evidence'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('grant select on table public.%I to anon, authenticated', table_name);
    end if;
  end loop;
end $$;
