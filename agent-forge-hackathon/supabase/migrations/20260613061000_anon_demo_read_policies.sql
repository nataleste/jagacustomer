create policy "Anon demo clients can read unassigned calls" on public.calls
  for select to anon using (user_id is null);

create policy "Anon demo clients can read unassigned transcript" on public.transcript_segments
  for select to anon using (exists (
    select 1 from public.calls where calls.id = transcript_segments.call_id and calls.user_id is null
  ));

create policy "Anon demo clients can read unassigned partials" on public.transcript_partials
  for select to anon using (exists (
    select 1 from public.calls where calls.id = transcript_partials.call_id and calls.user_id is null
  ));

create policy "Anon demo clients can read unassigned risks" on public.risk_signals
  for select to anon using (exists (
    select 1 from public.calls where calls.id = risk_signals.call_id and calls.user_id is null
  ));

create policy "Anon demo clients can read unassigned evidence" on public.evidence_moments
  for select to anon using (exists (
    select 1 from public.calls where calls.id = evidence_moments.call_id and calls.user_id is null
  ));

create policy "Anon demo clients can read unassigned recordings" on public.recordings
  for select to anon using (exists (
    select 1 from public.calls where calls.id = recordings.call_id and calls.user_id is null
  ));

create policy "Anon demo clients can read unassigned jobs" on public.jobs
  for select to anon using (exists (
    select 1 from public.calls where calls.id = jobs.call_id and calls.user_id is null
  ));

do $$
begin
  if to_regclass('public.media_evidence') is not null then
    create policy "Anon demo clients can read unassigned media evidence" on public.media_evidence
      for select to anon using (exists (
        select 1 from public.calls where calls.id = media_evidence.call_id and calls.user_id is null
      ));
  end if;
end $$;
