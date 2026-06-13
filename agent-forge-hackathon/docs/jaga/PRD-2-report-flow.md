---
summary: PRD for JAGA's incident report flow, where timestamped transcript and media evidence are displayed with traceability.
read_when:
  - Designing or implementing the incident report experience.
  - Mapping SenseNova and VideoDB into the report workflow.
  - Preparing the hackathon demo path from transcript evidence to report artifact.
---

# PRD 2: Incident Report Flow

## Objective

Turn a completed suspicious call into a traceable incident report that a user can understand, trust, and share.

The report flow is not where the bulk of scam detection happens. Detection should mostly happen during the live flow. The report flow focuses on displaying the result, preserving evidence, and proving where each claim came from.

## Customer Job

After a suspicious call, the user wants a clean record of what happened and what to do next, without manually assembling timestamps, transcript quotes, and evidence.

## User Flow

```text
Call ends
  -> Twilio finalizes recording and transcript
  -> backend finalizes detected evidence moments
  -> VideoDB indexes source audio/video with timestamps
  -> report is generated from transcript evidence
  -> user opens the past call
  -> user reviews transcript, evidence, and report
  -> user shares or files the report
```

## Product Requirements

- Past Call Detail must treat the transcript as the main reading surface.
- Evidence moments must map back to timestamps in the call.
- The report must cite the transcript lines or clips behind each important claim.
- Evidence emphasis should be subtle: light tint, text weight, and timestamp, not dramatic warning decoration.
- The user should be able to open the report from a past call.
- The report should include summary, timeline, key evidence, detection reasons, and recommended next steps.
- The user should not be required to curate evidence before the first draft report exists.

## Data Traceability

Each report claim should be traceable to source material:

```text
Report claim
  -> tactic label
  -> transcript quote
  -> timestamp
  -> source media segment
```

Example:

```text
Claim: Caller used payment pressure.
Reason: Gift card request.
Quote: "Buy four gift cards and do not tell anyone else."
Timestamp: 03:55
Evidence: source call segment at 03:55
```

## AI Stack Roles

| Component | Purpose |
|---|---|
| Twilio | Final transcript, recording, timestamps, call metadata. |
| Backend jobs | Finalize call record, evidence moments, report draft, and report status. |
| Kimi | Summarize call, classify tactics, produce next steps, draft report language. |
| VideoDB | Index source audio/video evidence and provide timestamped traceability back to media segments. |
| SenseNova | Generate or polish the user-facing incident report artifact. |
| Mobile web app | Display transcript, evidence, report status, and share/export actions. |

## Hackathon Demo

The demo should make traceability visible:

```text
Past call opens
  -> transcript shows evidence moments
  -> user opens report
  -> report shows timestamped evidence
  -> user taps or points to "View evidence at 03:55"
```

VideoDB is included in the report flow. It must be visible as evidence indexing, not hidden plumbing.

## Non-Goals

- No broad case-management system.
- No manual evidence curation as a required step.
- No claim that the report is an official police report.
- No hidden VideoDB usage that is invisible to the user or judges.

## Success Criteria

- The report feels grounded in transcript evidence, not hallucinated summary.
- A judge can see exactly why VideoDB matters.
- SenseNova improves the report artifact or multilingual/plain-language output.
- The user can understand what happened without replaying the whole call.
