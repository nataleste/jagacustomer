create table if not exists public.media_evidence (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  recording_id uuid references public.recordings(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  source text not null default 'videodb',
  source_media_id text,
  start_seconds numeric,
  end_seconds numeric,
  start_ms integer,
  end_ms integer,
  timestamp_label text not null,
  label text not null,
  summary text not null,
  confidence numeric,
  playback_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.media_evidence enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'media_evidence'
      and policyname = 'Users can read media evidence for owned calls'
  ) then
    create policy "Users can read media evidence for owned calls" on public.media_evidence
      for select using (exists (
        select 1 from public.calls where calls.id = media_evidence.call_id and calls.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'media_evidence'
      and policyname = 'Demo clients can read media evidence for unassigned calls'
  ) then
    create policy "Demo clients can read media evidence for unassigned calls" on public.media_evidence
      for select using (exists (
        select 1 from public.calls where calls.id = media_evidence.call_id and calls.user_id is null
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'media_evidence'
      and policyname = 'Anon demo clients can read unassigned media evidence'
  ) then
    create policy "Anon demo clients can read unassigned media evidence" on public.media_evidence
      for select to anon using (exists (
        select 1 from public.calls where calls.id = media_evidence.call_id and calls.user_id is null
      ));
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.media_evidence;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
