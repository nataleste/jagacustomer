---
summary: Working brief for understanding the Agent Forge hackathon AI stack and how to turn sponsor tools into buildable ideas.
read_when:
  - Preparing project ideas for the Agent Forge AI Hackathon.
  - Choosing which sponsor tools to integrate into a demo.
  - Explaining the AI stack in product or judging terms.
---

# AI Stack Understanding

This doc captures the current working model for the Agent Forge AI Hackathon stack. The goal is to understand what each tool gives an agent, then choose a small combination that can become a credible one-day demo.

## Contents

- [Event Frame](#event-frame)
- [Stack Mental Model](#stack-mental-model)
- [Tool Shorthand](#tool-shorthand)
- [Sponsor Visibility](#sponsor-visibility)
- [Project Direction Patterns](#project-direction-patterns)
- [Judging Implications](#judging-implications)
- [Open Questions](#open-questions)

## Event Frame

Agent Forge is positioned around building production AI systems, not simple chatbots. The listing emphasizes systems that can scrape live data, automate workflows, manage infrastructure, deploy at scale, and use sponsor tools.

The current public listing does not name judges. It lists judging criteria:

- Completeness
- Innovation
- Real-Life Problem Solving
- Sponsored Product Usage

Working assumption: sponsor-product usage matters materially. A strong project should make the sponsor stack visible in the actual product flow, not just mention it in the pitch.

## Stack Mental Model

Think of the stack as agent infrastructure:

```text
User or workflow
  -> model / agent brain
  -> perception and data tools
  -> execution and compute tools
  -> trust / identity layer
  -> useful output artifact
```

Practical grouping:

- Kimi AI and SenseNova U1 -> think
- Bright Data and VideoDB -> perceive
- Daytona and Nosana -> execute
- Terminal 3 -> trust
- SenseNova Skills -> produce polished artifacts

The best hackathon move is probably not to use every tool. Use two or three tools in a way that is obvious, functional, and central to the demo.

## Tool Shorthand

- Kimi AI -> give agents a strong reasoning/coding brain for long-context tasks and multi-step tool use
- Bright Data -> give agents reliable access to live public web data
- Daytona -> give agents safe computers where they can run code, tests, scripts, and workflows
- Nosana -> give agents access to GPU compute for heavier model inference or processing jobs
- SenseNova U1 -> give agents native multimodal understanding and image generation
- SenseNova Skills -> give agents ready-made office/productivity abilities like Excel analysis, PPTs, infographics, and deep research
- Terminal 3 -> equip AI agents with verifiable identity to act and transact on behalf of users
- VideoDB -> add meaning, memory, search, and actionability to videos, streams, and screen recordings

## Sponsor Visibility

The current Luma listing supports a visibility-bucket view rather than a single "main sponsor" claim.

- AI Builders -> main presenter / organizer
- SMU AI Club -> local institutional co-host and venue/community partner
- Daytona, Bright Data, Nosana, Terminal 3 -> host-level sponsor visibility on the Luma page
- Kimi, SenseNova, VideoDB -> AI stack/product partners listed in the stack description

Important correction: Terminal 3 should not be described as the main sponsor based only on the listing. Daytona, Bright Data, Nosana, and Terminal 3 all appear in the host-level visibility bucket. Daytona also has a strong practical signal because the listing says each participant gets USD 100 worth of Daytona credits.

## Project Direction Patterns

The stack can support several project directions. Keep these as patterns, not commitments:

- Data-to-action agent: collect live public data, reason over it, and produce alerts, reports, or automated workflow steps.
- Safe code/data worker: let an agent write and run code in a sandbox to analyze files, test changes, or transform inputs into useful artifacts.
- Trusted agent workflow: give an agent scoped identity, permissions, or consent so it can act on behalf of users in a controlled way.
- Multimodal analyst: use text, image, video, spreadsheet, or document inputs to produce structured insight and polished outputs.
- Infrastructure demo: show how a production agent needs model reasoning, external data, execution, trust, and deployment rather than just chat.

Good project shape:

- Input: a real data source, file, stream, document, or user request.
- Agent reasoning: model decides what to do and which tools to call.
- Execution: sandbox, compute, search, data collection, or trusted action.
- Output: a useful artifact such as a report, alert, dashboard, clip, table, workflow result, or decision memo.

## MVP Lab

This repo now includes a small runnable AI Stack MVP Lab with one minimum presentable demo per stack tool. Read [AI Stack MVP Runbook](./ai-stack-mvp-runbook.md) before the hackathon meeting.

## Judging Implications

For a two-minute demo, the stack needs to be legible:

- Completeness: show one working flow from input to useful output.
- Innovation: position the project as an agent workflow with production-like infrastructure, not a generic chatbot.
- Real-life problem solving: name the user, the repeated pain, and why existing workflows are manual, expensive, slow, or brittle.
- Sponsored Product Usage: make one or two sponsor tools central to the flow.

Candidate stack choices:

- Sponsor-visibility route: Daytona + Bright Data + Terminal 3
- General agent route: Kimi + Bright Data + Daytona
- Multimodal route: SenseNova U1 + SenseNova Skills + Daytona
- Video-native route: VideoDB + Kimi or SenseNova + Daytona
- Trust/compliance route: Terminal 3 + Daytona + Kimi or Bright Data

## Open Questions

- Are current judges or mentor panels announced privately to registered attendees?
- Which sponsor APIs will be easiest to access on hackathon day?
- Which sponsor integration gives the clearest demo value in two minutes?
- Can Terminal 3's Agent Dev Kit be demoed quickly as identity, permissioning, or compliance without overbuilding?
- Which project direction should be tested first with the least throwaway work?
