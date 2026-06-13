---
summary: Technical spec for JAGA's mobile web backend flow using Vite React, Supabase Auth, Twilio Native Real-Time Transcription, Supabase Realtime, and async AI jobs.
read_when:
  - Implementing JAGA's mobile web app, backend API, live transcript ingestion, or async report pipeline.
  - Deciding how Twilio, Supabase, Kimi, SenseNova, VideoDB, and Terminal 3 interact.
  - Explaining the hackathon architecture without introducing unnecessary realtime infrastructure.
---

# TECH SPEC: Backend Flow

## Objective

Use Supabase as the main backend layer for auth, durable data, realtime updates, and job state, with thin serverless functions handling privileged webhooks, vendor secrets, normalization, and async job orchestration.

The client is a **mobile web app built with Vite + React**. JAGA is not building a native app for the hackathon v1.

This spec assumes the canonical call capture path:

```text
Native phone call
  -> user taps Add People
  -> user adds the JAGA/Twilio number
  -> Twilio receives one inbound call leg
  -> Twilio Native Real-Time Transcription POSTs transcript events to JAGA
```

## Contents

- [Architecture Decision](#architecture-decision)
- [Deployment Model](#deployment-model)
- [System Roles](#system-roles)
- [Live Call Flow](#live-call-flow)
- [Live Kimi Inference](#live-kimi-inference)
- [Transcription vs Recording](#transcription-vs-recording)
- [Async Job Flow](#async-job-flow)
- [Data Model](#data-model)
- [Realtime Strategy](#realtime-strategy)
- [Non-Goals](#non-goals)

## Architecture Decision

Recommended v1 architecture:

```text
Vite + React mobile web app
  -> deployed to Vercel
  -> Supabase Auth for login/session
  -> Supabase Realtime for live call/report updates
  -> Supabase Edge Functions for privileged actions

Twilio
  -> Supabase Edge Function webhook endpoint
  -> normalized rows in Supabase
  -> Supabase Realtime updates mobile web app

Backend async jobs
  -> Kimi / SenseNova / VideoDB / scraping / Terminal 3
  -> write progress and results back to Supabase
  -> Supabase Realtime updates mobile web app
```

The key decision is to make **Supabase the backend-heavy layer and live data plane**, not a custom SSE/WebSocket server.

Transcript chunks, risk signals, job progress, report sections, evidence references, and filing receipts are all user-visible state. They should be persisted as rows first, then streamed to the app through Supabase Realtime.

## Deployment Model

The code is deployed in two places:

```text
Frontend code
  -> Vite + React mobile web app
  -> deployed to Vercel

Backend code
  -> Supabase Edge Functions
  -> deployed to Supabase
```

Supabase also hosts the backend services:

```text
Supabase Auth
Supabase Postgres
Supabase Realtime
Supabase Storage
Supabase job state
```

Twilio webhook URLs should point to Supabase Edge Functions, not the Vercel frontend.

Canonical deployed shape:

```text
Vercel
  -> serves the mobile web app

Supabase
  -> Auth, database, realtime, storage
  -> Edge Functions: /twilio/voice, /twilio/transcription, /twilio/recording, job handlers

Twilio
  -> calls Supabase Edge Function URLs
```

## System Roles

| Layer | Responsibility |
|---|---|
| Vercel | Hosts the Vite + React mobile web app as the hackathon frontend. |
| Vite + React mobile web app | Authenticated mobile experience: call log, live transcript, past call, incident report, filing receipt. |
| Supabase Auth | User identity and session issuance. The mobile web app signs in with Supabase and sends the access token to privileged functions when needed. |
| Supabase Postgres | System of record for users, calls, transcript segments, risk signals, evidence moments, jobs, reports, and receipts. |
| Supabase Realtime | Streams database changes to the mobile web app for live transcript and job/report updates. |
| Supabase Edge Functions | Privileged server boundary. Receives Twilio webhooks, validates signatures, verifies Supabase JWTs, owns vendor secrets, normalizes payloads, and creates async jobs. |
| Twilio | Call participant, live transcription provider, and recording provider. Uses Native Real-Time Transcription plus call recording, not Media Streams, for v1. |
| Job runner | Runs async work outside request-response paths: Kimi, SenseNova, VideoDB, scraping/research, Terminal 3 filing. |
| Kimi | Live and post-call reasoning: scam tactic detection, summaries, next steps, report draft content. |
| SenseNova | User-facing report generation or polishing. |
| VideoDB | Timestamped evidence indexing for report traceability. |
| Terminal 3 | Signed, user-consented report filing action and receipt. |

## Live Call Flow

```text
1. Twilio receives inbound call to the JAGA number.
2. Twilio calls POST /twilio/voice.
3. Backend creates or finds a call record in Supabase.
4. Backend returns TwiML that starts both recording and real-time transcription.
5. Twilio POSTs transcription events to /twilio/transcription.
6. Backend stores the raw Twilio event for audit/debugging.
7. Backend normalizes final and partial transcript state.
8. Supabase Realtime streams transcript rows/state to the mobile web app.
9. Backend triggers lightweight Kimi detection on final transcript windows.
10. Kimi detection results are written as risk signal/evidence rows.
11. Twilio POSTs recording lifecycle events to /twilio/recording.
12. Backend stores recording metadata for playback, evidence, and VideoDB indexing.
13. Supabase Realtime streams those rows to the mobile web app.
```

## Live Kimi Inference

JAGA should still provide live safety inference during the call. The constraint is that Kimi should not run on every partial transcript update.

Use this split:

```text
Twilio partial transcript
  -> update live transcript UI quickly

Twilio final utterance or small finalized window
  -> trigger Kimi live-risk detection
  -> write risk signal / evidence rows
  -> Supabase Realtime updates mobile web app
```

Partials are for making the transcript feel immediate. Finalized utterances or small sliding windows are for safer, cheaper, less noisy Kimi analysis.

Target behavior:

```text
Suspicious line is spoken
  -> partial text appears quickly
  -> utterance finalizes
  -> Kimi analyzes the last few finalized utterances
  -> safety signal appears near-live
```

## Transcription vs Recording

Twilio Real-Time Transcription is the live text path. It sends HTTP callbacks with transcript events. It does not give JAGA an audio artifact for playback or incident evidence.

Twilio recording is the audio evidence path. JAGA should start recording alongside real-time transcription so the completed call has a source audio file for playback, report traceability, and VideoDB indexing.

```text
Twilio Real-Time Transcription
  -> HTTP transcript callbacks
  -> live transcript UI
  -> near-live Kimi safety inference

Twilio Recording
  -> recording lifecycle callback
  -> audio file metadata / recording URL
  -> playback, incident evidence, VideoDB indexing
```

The two paths should be treated as complementary. Do not replace live transcription with recording-only transcription, because recording transcription is post-call and weaker for the live safety experience.

In the native Add People topology, Twilio records the audio it receives as its inbound call leg. That audio is likely carrier-mixed, so it is acceptable for evidence/playback but not reliable for clean speaker separation.

The mobile web app should subscribe by internal `call_id` or `incident_id`, not Twilio `CallSid`.

Twilio identifiers are stored as vendor metadata:

- `CallSid`: Twilio inbound call leg identifier.
- `TranscriptionSid`: Twilio transcription session identifier.
- `RecordingSid`: Twilio recording artifact identifier, if recording is enabled.
- `Track`: usually `inbound_track` in the native Add People topology.

Do not treat `ConferenceSid` as required. In the native Add People flow, Twilio is not creating the conference and may only see one inbound leg.

## Async Job Flow

Async jobs are started by backend events, not by the mobile web app directly writing privileged state.

```text
Transcript/event arrives
  -> backend writes normalized rows
  -> backend enqueues job if needed
  -> worker calls vendor/service
  -> worker writes job status and result rows
  -> Supabase Realtime updates mobile web app
```

Recommended job types:

| Job | Trigger | Output |
|---|---|---|
| `live-risk-detection` | Final transcript segment or sliding transcript window. | Risk signal rows, tactic labels, evidence candidate rows. |
| `post-call-summary` | Call completed. | Call summary, timeline, next steps. |
| `videodb-index` | Twilio recording finalized. | Timestamped media evidence references. |
| `sensenova-report` | Report requested or call classified as report-worthy. | User-facing report artifact or polished report sections. |
| `scrape-research` | Report needs external context, such as scam pattern or public source enrichment. | Source-backed context rows attached to report. |
| `terminal3-file` | User confirms report filing. | Signed filing receipt and mock/sandbox endpoint response. |

For hackathon v1, prefer a Supabase-centered job pattern: create rows in `jobs`, run serverless job handlers, and write status/results back to Supabase. If jobs need stronger retries, batching, or dead-letter handling, add a queue layer later.

## Data Model

Minimum durable tables:

| Table | Purpose |
|---|---|
| `calls` | Internal call record, user ownership, Twilio call metadata, status, started/ended timestamps. |
| `twilio_events` | Raw webhook payloads for audit, debugging, and replay. |
| `transcript_segments` | Final transcript rows shown in live and past call views. |
| `transcript_partials` | Replaceable partial transcript state, if the UI shows interim text. |
| `recordings` | Twilio recording metadata, status, URL/reference, duration, and recording timestamps. |
| `risk_signals` | Kimi-detected tactics and confidence linked to transcript spans. |
| `evidence_moments` | Timestamped evidence rows used by the report flow. |
| `jobs` | Async job status, vendor, attempts, errors, and progress. |
| `reports` | Generated incident report state and user-facing report sections. |
| `media_evidence` | VideoDB/source media references linked to timestamps. |
| `filing_receipts` | Terminal 3 signed action and mock/sandbox filing response. |

The app should always fetch the latest persisted state first, then subscribe to realtime updates. Realtime is not the source of truth.

## Realtime Strategy

Default v1 strategy:

- Mobile web app uses Supabase Auth.
- Mobile web app fetches `calls`, transcript, report, and job state from Supabase.
- Mobile web app subscribes to call-scoped Supabase Realtime updates.
- Supabase Edge Functions write all privileged state changes into Supabase.

For the hackathon, Supabase Postgres Changes are acceptable because they are straightforward and map directly to row inserts/updates.

If realtime scale or stricter authorization becomes a concern, move the live feed to Supabase Broadcast with database triggers or backend-originated broadcasts.

Use custom SSE/WebSockets only if Supabase Realtime becomes the bottleneck or the product needs a non-database event stream.

Use Durable Objects only if JAGA moves to Twilio Media Streams or another raw-audio/live-room architecture. They are not needed for Twilio Native Real-Time Transcription v1.

## Non-Goals

- No Twilio Media Streams for v1.
- No Durable Object live-call coordinator for v1.
- No custom realtime server unless Supabase Realtime proves insufficient.
- No in-app call controls.
- No assumption that Twilio can separate speakers in the native Add People topology.
- No native app for hackathon v1.
- No direct browser calls to Kimi, SenseNova, VideoDB, scraping providers, or Terminal 3.

## Canonical Deployment Decision

The thin function runtime is no longer open for v1:

- **Frontend**: Vite + React mobile web app on Vercel.
- **Backend code**: Supabase Edge Functions.
- **Backend services**: Supabase Auth, Postgres, Realtime, Storage, and job state.

Cloudflare Workers, Hono, Durable Objects, and Next.js API routes are optional later paths, not the v1 architecture.
