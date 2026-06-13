---
summary: PRD for JAGA's police reporting flow, where Terminal 3 supports signed, consented report filing.
read_when:
  - Designing or implementing the report-to-authority flow.
  - Deciding how Terminal 3 fits into the JAGA demo.
  - Preparing the hackathon ending from incident report to signed filing receipt.
---

# PRD 3: Police Reporting Flow

## Objective

Let the user file or prepare a scam report packet with clear consent, traceable evidence, and a signed receipt.

This is the trusted action flow. It should turn JAGA from "the app warned me" into "the app helped me act."

## Customer Job

After reviewing a suspicious call report, the user wants to send a credible report to the right authority or support channel without retyping the story.

## User Flow

```text
User opens incident report
  -> user taps Report to Police
  -> app previews report packet
  -> user confirms consent
  -> Terminal 3 signs the filing action
  -> report posts to a sandbox/mock police endpoint
  -> app shows filing receipt
```

For the hackathon, the endpoint should be a sandbox or mock target. Do not imply that the demo files a real police report unless that integration is actually authorized.

## Product Requirements

- The flow must begin from an existing incident report.
- The report packet must include summary, transcript evidence, timestamps, and source media references.
- The user must explicitly confirm before filing.
- The confirmation screen must explain what data is being sent.
- Terminal 3 must be used for signed or authorized filing, not just a decorative badge.
- The final screen must show a filing receipt with case ID, timestamp, destination, and signed action status.

## Report Packet

Minimum packet:

- User-visible report summary.
- Call metadata: time, duration, caller if available.
- Key evidence moments with timestamps.
- Transcript excerpts.
- VideoDB source evidence references, if available.
- Detection reasons.
- User consent timestamp.
- Terminal 3 signed filing receipt.

## AI Stack Roles

| Component | Purpose |
|---|---|
| Terminal 3 | Signed user-authorized action, agent identity, filing receipt. |
| Backend API | Create filing packet, call mock endpoint, persist receipt. |
| VideoDB | Provide timestamped evidence references for report packet traceability. |
| SenseNova | Provide polished report text included in the packet. |
| App frontend | Consent preview, submit action, receipt display. |

## Hackathon Demo

The reporting flow should be the final punchline:

```text
Open incident report
  -> tap Report to Police
  -> confirm consent
  -> Terminal 3 signs action
  -> mock endpoint receives packet
  -> app shows signed receipt
```

Judge-facing line:

> JAGA does not just warn the user. It creates a traceable report packet and files it with signed user authorization.

## Non-Goals

- No real police filing unless an authorized sandbox exists.
- No hidden auto-reporting without user confirmation.
- No generic "share" flow pretending to be Terminal 3.
- No legal claims that JAGA determines guilt or verifies identity beyond the evidence it has.

## Success Criteria

- Terminal 3 has a clear, load-bearing purpose.
- The user consent step is explicit.
- The receipt is visible and demoable.
- The filing packet traces back to report evidence and source timestamps.
