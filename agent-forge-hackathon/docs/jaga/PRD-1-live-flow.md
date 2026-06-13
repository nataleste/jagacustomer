---
summary: PRD for JAGA's live call flow, where Twilio transcription and backend analysis detect scam signals during the call.
read_when:
  - Designing or implementing the live call experience.
  - Deciding which AI stack components belong in real-time scam detection.
  - Preparing the hackathon demo path from active call to detected evidence.
---

# PRD 1: Live Flow

## Objective

Let the user know JAGA is capturing and analyzing a suspicious call without asking them to operate the app during the call.

The live flow is the main AI detection moment. It should show that scam signals are being detected as the transcript arrives, while native call handling remains outside JAGA.

## Customer Job

When a suspicious call is happening, the user wants reassurance that the call is being watched and preserved, without needing to think through the scam in real time.

## User Flow

```text
Suspicious call happens
  -> user taps Add People in the native Phone UI
  -> user adds the JAGA/Twilio number as a third participant
  -> the call becomes a 3-way conference call
  -> Twilio records and transcribes the call
  -> JAGA receives transcript chunks and call metadata
  -> backend analyzes transcript chunks automatically
  -> Calls Home highlights a live call
  -> user may tap in to read the live transcript
  -> no required user action during the call
```

## Product Requirements

- Calls Home must show an obvious `Live call` card when a call is active.
- Live detail must show a transcript-first view: timestamp, speaker, utterance.
- Live detail may show small risk metadata, such as `High risk` or `2 signals`.
- Call capture must be described as a user-initiated `Add People` / 3-way conference flow, not carrier routing or call interception.
- The backend must detect scam signals automatically from Twilio transcript chunks.
- The user may mark a moment or add a note, but this must be optional.
- The app must not show native call controls such as end, merge, mute, hold, or record.
- The UI should state or imply that recording/transcription is handled in Phone/Twilio, not inside JAGA.

## AI Stack Roles

| Component | Purpose |
|---|---|
| Twilio | Joins as the JAGA number in a user-initiated 3-way conference call; records, transcribes, timestamps, and emits call metadata. |
| Backend jobs | Normalize transcript chunks, maintain live call state, trigger detection jobs. |
| Model layer | Detect scam tactics such as urgency, secrecy, impersonation, credential request, or payment pressure. |
| App frontend | Show live call card and live transcript state. |
| Storage | Persist transcript chunks, signal detections, notes, and call state. |

## Hackathon Demo

The demo can use scripted Twilio-style transcript chunks streamed into the backend. This keeps the live flow reliable while still showing the intended real-time behavior.

Demo beat:

```text
Calls Home shows Live call
  -> live transcript opens
  -> suspicious line arrives
  -> backend flags it
  -> evidence moment appears subtly in transcript
```

## Non-Goals

- No in-app call handling.
- No requirement for the user to tag evidence during the call.
- No live police reporting during the call.
- No heavy dashboard treatment or giant risk score as the main object.

## Success Criteria

- A viewer understands that JAGA is transcript-first within 10 seconds.
- Scam detection happens automatically during the live flow.
- The live transcript remains readable and calm.
- The demo works even if the transcript stream is mocked.
