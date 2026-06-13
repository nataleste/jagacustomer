---
summary: Hackathon concept brief for the canonical V2 scam-call app, centered on call logs, transcripts, and incident reports.
read_when:
  - Preparing the scam-call app for an Agent Forge hackathon demo.
  - Aligning on the canonical V2 call log, live transcript, and past call flows.
  - Explaining the product wedge, demo path, and sponsor-tool fit.
---

# Scam Call App

Canon: V2 is the product shape. The app is a transcript-first call log that turns suspicious calls into clean incident reports.

## Hackathon Frame

This should demo as a narrow, useful workflow:

```text
suspicious call
  -> user taps Add People in the native Phone UI
  -> user adds the JAGA/Twilio number as a third participant
  -> Twilio records and transcribes the 3-way conference call
  -> app receives transcript and call metadata
  -> agent identifies evidence moments
  -> user reviews the call
  -> app produces an incident report
```

The judge-facing promise:

> A call log for scam incidents: every suspicious call becomes a readable transcript, and every transcript can become an evidence-grade report.

This is not a scam-warning dashboard. It is a post-call memory and reporting tool with a live transcript state.

## Canonical V2 Flow

V2 has three primary screens:

1. `Calls Home`
2. `Live Call Detail`
3. `Past Call Detail`

Everything else should support those screens.

### Calls Home

The home screen proves the whole product quickly:

- Calls are first-class records.
- A `Live call` card is highlighted when a call is being transcribed.
- Past calls show transcript status, evidence count, and report status.
- Risk is visible but secondary.

For the demo, this is the opening frame. It tells judges what the app is before any explanation.

### Live Call Detail

Tapping the live call opens a transcript-first view:

- Header: caller, elapsed time, `Recording in Phone`.
- Body: simple timestamp + speaker + utterance transcript.
- Light evidence emphasis for suspicious moments.
- App actions: `Mark moment`, `Add note`.

Native call handling stays outside the app. Do not show `End call`, merge, hold, mute, or recording controls.

Call capture is user-initiated through the native Phone `Add People` flow. JAGA should not be described as carrier routing, silent interception, or automatic call access.

### Past Call Detail

Tapping a past call opens the completed transcript:

- Header: caller, date, duration, word count, report status.
- Body: transcript as the main reading surface.
- Evidence moments are lightly tinted, not decorated like a security alert.
- Actions: `Open report`, `Share`.

The report should feel generated from transcript evidence. It should not feel like a separate CRM object.

## Core Flow

```text
Calls home
  -> tap live call
  -> live transcript view
  -> mark moments or add notes
  -> later generate or open incident report

Calls home
  -> tap past call
  -> completed transcript view
  -> review evidence moments
  -> open, edit, export, or share report
```

## Demo Story

Two-minute demo path:

1. Open on `Calls Home`.
2. Point to the active `Live call`.
3. Tap into the live transcript.
4. Mark one suspicious transcript moment.
5. Return or jump to a past call.
6. Show the completed transcript with evidence moments.
7. Open or share the generated incident report.

The demo should end on a useful artifact: a clean incident report that a user could send to a trusted contact, bank, or platform support team.

## Sponsor-Tool Fit

Keep this grounded and practical:

- Model layer, such as Kimi or SenseNova: classify scam tactics, summarize the call, and draft report sections from transcript evidence.
- Daytona: run the repeatable report-generation workflow in a sandboxed backend.
- Terminal 3, if available: represent consent, user identity, report sharing permissions, or trusted-contact authorization.
- Bright Data, if useful: enrich caller context or public scam-pattern references, but only if it is central enough to demo clearly.
- SenseNova Skills, if useful: produce a polished PDF or document-style incident report.

Avoid using sponsor tools decoratively. One strong transcript-to-report workflow is better than four shallow integrations.

## Transcript UI Direction

Use the simplest possible transcript UI:

- Stable timestamp lane.
- Bold speaker label.
- Muted transcript text.
- Light background tint for evidence moments.
- No heavy alert stripes, giant risk widgets, or “AI dashboard” theatrics.
- The user should feel they are reading a call record, not operating a security console.

## MVP Scope

Build only the path needed to prove the concept:

- Static or mocked call log.
- One live transcript state.
- One past call transcript.
- Evidence moment marking.
- Incident report generation from selected transcript lines.
- Share/export affordance, even if mocked.

## Non-Goals

- Native call handling inside the app.
- Recreating native phone controls.
- Making live risk scoring the center of the experience.
- Full CRM, support desk, or law-enforcement workflows.
- Over-designed scam-detection theatrics that distract from the transcript.

## Open Decision

For the hackathon MVP, decide whether the report is:

- Auto-generated once a call crosses a suspicious threshold.
- Generated only after the user marks evidence or taps `Open report`.

Default recommendation: user-triggered report generation. It is easier to explain, safer from a consent perspective, and makes the transcript-first workflow clearer.
