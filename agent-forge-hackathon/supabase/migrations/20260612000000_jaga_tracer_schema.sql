create extension if not exists pgcrypto;

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  caller text,
  status text not null default 'idle',
  twilio_call_sid text unique,
  started_at timestamptz default now(),
  ended_at timestamptz,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.twilio_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  event_type text not null,
  twilio_call_sid text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  twilio_call_sid text,
  transcription_sid text,
  sequence_id integer,
  track text,
  speaker text not null default 'Caller',
  transcript text not null,
  confidence numeric,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.transcript_partials (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  transcription_sid text,
  sequence_id integer,
  track text,
  transcript text not null,
  updated_at timestamptz not null default now(),
  unique (call_id, transcription_sid, sequence_id, track)
);

create table if not exists public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  transcript_segment_id uuid references public.transcript_segments(id) on delete cascade,
  label text not null,
  severity text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_moments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  transcript_segment_id uuid references public.transcript_segments(id) on delete cascade,
  risk_signal_id uuid references public.risk_signals(id) on delete set null,
  timestamp_label text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  twilio_call_sid text,
  recording_sid text unique,
  status text not null,
  recording_url text,
  duration_seconds integer,
  track text,
  channels integer,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.calls enable row level security;
alter table public.twilio_events enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.transcript_partials enable row level security;
alter table public.risk_signals enable row level security;
alter table public.evidence_moments enable row level security;
alter table public.recordings enable row level security;
alter table public.jobs enable row level security;
alter table public.media_evidence enable row level security;

create policy "Users can read owned calls" on public.calls
  for select using (auth.uid() = user_id);

create policy "Demo clients can read unassigned calls" on public.calls
  for select using (user_id is null);

create policy "Users can read transcript for owned calls" on public.transcript_segments
  for select using (exists (
    select 1 from public.calls where calls.id = transcript_segments.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read transcript for unassigned calls" on public.transcript_segments
  for select using (exists (
    select 1 from public.calls where calls.id = transcript_segments.call_id and calls.user_id is null
  ));

create policy "Users can read Twilio events for owned calls" on public.twilio_events
  for select using (exists (
    select 1 from public.calls where calls.id = twilio_events.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read Twilio events for unassigned calls" on public.twilio_events
  for select using (exists (
    select 1 from public.calls where calls.id = twilio_events.call_id and calls.user_id is null
  ));

create policy "Users can read partials for owned calls" on public.transcript_partials
  for select using (exists (
    select 1 from public.calls where calls.id = transcript_partials.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read partials for unassigned calls" on public.transcript_partials
  for select using (exists (
    select 1 from public.calls where calls.id = transcript_partials.call_id and calls.user_id is null
  ));

create policy "Users can read risks for owned calls" on public.risk_signals
  for select using (exists (
    select 1 from public.calls where calls.id = risk_signals.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read risks for unassigned calls" on public.risk_signals
  for select using (exists (
    select 1 from public.calls where calls.id = risk_signals.call_id and calls.user_id is null
  ));

create policy "Users can read evidence for owned calls" on public.evidence_moments
  for select using (exists (
    select 1 from public.calls where calls.id = evidence_moments.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read evidence for unassigned calls" on public.evidence_moments
  for select using (exists (
    select 1 from public.calls where calls.id = evidence_moments.call_id and calls.user_id is null
  ));

create policy "Users can read recordings for owned calls" on public.recordings
  for select using (exists (
    select 1 from public.calls where calls.id = recordings.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read recordings for unassigned calls" on public.recordings
  for select using (exists (
    select 1 from public.calls where calls.id = recordings.call_id and calls.user_id is null
  ));

create policy "Users can read jobs for owned calls" on public.jobs
  for select using (exists (
    select 1 from public.calls where calls.id = jobs.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read jobs for unassigned calls" on public.jobs
  for select using (exists (
    select 1 from public.calls where calls.id = jobs.call_id and calls.user_id is null
  ));

create policy "Users can read media evidence for owned calls" on public.media_evidence
  for select using (exists (
    select 1 from public.calls where calls.id = media_evidence.call_id and calls.user_id = auth.uid()
  ));

create policy "Demo clients can read media evidence for unassigned calls" on public.media_evidence
  for select using (exists (
    select 1 from public.calls where calls.id = media_evidence.call_id and calls.user_id is null
  ));

alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.transcript_segments;
alter publication supabase_realtime add table public.transcript_partials;
alter publication supabase_realtime add table public.risk_signals;
alter publication supabase_realtime add table public.evidence_moments;
alter publication supabase_realtime add table public.recordings;
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.media_evidence;
