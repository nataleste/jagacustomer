---
summary: Judging strategy for shaping an Agent Forge project around MVP completeness, sponsor usage, and real market pain.
read_when:
  - Preparing the hackathon demo narrative.
  - Deciding which sponsor integrations deserve emphasis.
  - Turning a project direction into a judge-friendly pitch.
---

# Judging Strategy

This doc captures the judge-facing interpretation of the current Agent Forge listing and the sponsor blast context. The goal is to make the project easy to score against the public criteria while staying honest about what is confirmed.

## Contents

- [Public Criteria](#public-criteria)
- [Audience Signal](#audience-signal)
- [Sponsor Signals](#sponsor-signals)
- [How To Score Well](#how-to-score-well)
- [Project Shape](#project-shape)
- [Risks](#risks)

## Public Criteria

The listing gives four public judging criteria:

- Completeness: whether the team finished at least a minimum viable product.
- Innovation: whether the product idea is innovative.
- Real-Life Problem Solving: whether the project solves a real-life problem or real market pain.
- Sponsored Product Usage: whether the team used sponsored products.

Working interpretation: the judges are unlikely to reward an impressive idea if it does not run. A finished, narrow workflow should beat a broad concept demo with unclear sponsor usage.

## Audience Signal

The listing says the event is for developers, AI engineers, founders, and students who want to go beyond tutorials and build something real.

This suggests the demo should speak to builders:

- Show actual system behavior, not only slides.
- Make the sponsor APIs/tools visible in the flow.
- Prefer a concrete workflow over a generic assistant.
- Explain what was hard about making the agent production-like.

The co-host framing also matters. AI Builders describes itself as a community for developers, founders, and innovators who build real products, trial ideas with peers, and connect with cloud and AI partners to scale. SMU AI Club adds student/community credibility. The project should therefore read as both buildable and demoable to a mixed builder/student/founder audience.

## Sponsor Signals

The public Luma page supports a visibility-bucket view:

- AI Builders -> main presenter / organizer
- SMU AI Club -> local institutional co-host and venue/community partner
- Daytona, Bright Data, Nosana, Terminal 3 -> host-level sponsor visibility
- Kimi, SenseNova, VideoDB -> AI stack/product partners listed in the stack description

The later blast adds a specific Terminal 3 signal:

- The hackathon team called it a "Sponsor Spotlight: Terminal 3."
- The blast says Terminal 3 is launching an Agent Dev Kit.
- The emphasized problem is enterprise/government adoption, security, compliance, privacy requirements, and country-specific safety requirements.
- The blast points participants to an online developer meetup and a beta bounty challenge.

Conclusion: Terminal 3 is not proven to be the main sponsor, but it is actively spotlighted in organizer communications. Daytona also has strong practical visibility because the listing says participants get USD 100 Daytona credits. Bright Data remains highly practical because web data is easy for judges to understand. Nosana is host-visible but probably needs a GPU-heavy use case to feel central.

## How To Score Well

Completeness:

- Build one end-to-end path that works under demo conditions.
- Make the happy path short enough for a two-minute demo.
- Prepare fallback input data if live services are slow or unreliable.

Innovation:

- Avoid "chat with X" framing.
- Position the project as an agent workflow with perception, execution, trust, or automation.
- Name the new capability in one sentence.

Real-Life Problem Solving:

- Pick a buyer/user with a painful repeated workflow.
- Show why the current alternative is manual, expensive, slow, or unscalable.
- Connect the demo output to a real operational need.

Sponsored Product Usage:

- Use sponsor tools as core infrastructure, not decorative integrations.
- Name the sponsor role during the demo in plain language.
- Prefer one or two deep integrations over many shallow mentions.

## Project Shape

The safest project frame is:

> A production-like agent workflow that solves one repeated real-world problem by combining reasoning, external context, execution, and trust.

Judge-facing flow:

```text
Real input
  -> agent reasoning
  -> sponsor-backed tool call or execution
  -> visible result
  -> proof that the workflow can be trusted or repeated
```

Sponsor fit:

- Bright Data -> live public web data, monitoring, enrichment, or research collection.
- Daytona -> safe execution for code, scripts, tests, analysis, or repeatable workflows.
- Terminal 3 -> identity, permissioning, compliance, consent, or scoped agent authority.
- Kimi or SenseNova -> reasoning, coding, multimodal analysis, summaries, or generation.
- VideoDB -> searchable context, alerts, clips, and workflows from video or recorded media.
- Nosana -> heavier GPU-backed processing when compute is genuinely central.

Strongest two-minute demo:

1. State the user and painful repeated workflow.
2. Show the input.
3. Trigger the agent flow.
4. Show the sponsor-backed step.
5. End on a useful artifact, action, or decision.

## Risks

- Overbuilding infrastructure can threaten completeness.
- Terminal 3 can become abstract unless tied to consent, permissions, identity, or compliance.
- VideoDB should be verified early for the exact ingest path if the project uses video or recorded media.
- Sponsor usage should not obscure the user value. The judge should understand the problem before the stack.
