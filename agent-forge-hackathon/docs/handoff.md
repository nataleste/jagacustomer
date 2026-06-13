# JAGA — Handoff Doc (Agent Forge Hackathon)

**One-liner:** An AI fraud analyst in every family's pocket. Forward any suspicious message, link, or video call — JAGA investigates like a professional analyst in 60 seconds, explains the verdict in plain language, and files a report on your behalf.

**Problem:** Singaporeans lost $1.1B+ to scams last year. Fastest-growing vector: deepfake video calls impersonating police/banks, targeting the elderly and foreign students. Victims have no one to ask in the moment.

---

## Judging criteria → how we hit them

| Criterion | Our answer |
|---|---|
| Completeness | One golden path, end-to-end, rehearsed 5x. Fallback clips pre-recorded. |
| Innovation | Deepfake video-call triage (VideoDB) + agent that *acts* with verifiable identity (Terminal 3), not just warns. |
| Real-life problem | $1.1B scam losses, elderly-first UX ("MRT signage, not fintech app"). |
| Sponsored product usage | All 8 tools, each load-bearing (see map below). |

---

## Sponsor tool map (all 8, one owner each)

| Tool | Role | Owner |
|---|---|---|
| Kimi k2.6 | Triage agent + specialist swarm (parallel investigators) | Yeehan |
| TokenRouter | Model routing: cheap model for triage, k2.6 for confirmed-suspicious. "Under a cent per scan." | Yeehan |
| Daytona | Detonate suspicious URLs in isolated sandbox → screenshot + HTML | Hosan |
| Bright Data | Live lookups: domain age/WHOIS, phone number vs scam-report sites | Hosan |
| VideoDB | Scam video call clip → transcript → timestamped red flags | Mell |
| SenseNova U1 | Verdict card: big-font, plain-language, EN/中文/Melayu | Mell |
| Terminal 3 ADK | One-tap signed scam report → mock ScamShield endpoint (verifiable agent identity) | Mell |
| Nosana | Small model on decentralized GPU for PII-scrub / first-pass triage (privacy story) | Mell |

---

## Team slices

### Yeehan — Spine & Brain (integration owner)
- FastAPI server, `POST /investigate` endpoint, SSE stream to frontend
- **Hour 1: hardcoded fake-verdict spine so nobody is blocked**
- Kimi triage agent via TokenRouter → structured JSON verdict
- Swarm = triage agent dispatching specialists. Fallback: 3 parallel calls (`Promise.all`) with different system prompts
- Owns the golden path; nobody merges without him

### Hosan — Link slice (most isolated, safest)
- `investigate_link(url)`: Daytona sandbox detonation → screenshot + HTML
- Bright Data: exactly 2 lookups (domain age, phone-number scam check)
- Tests against **our own fake phishing page** ("DBS-Secure-Verify" on Vercel) — never a live scam URL
- Demo money shot: fake bank site rendering inside the sandbox

### Ade — mobile web frontend
- Vite + React mobile web app against Yeehan's SSE stream — fast browser iteration
- Entry flow: paste/forward suspicious text, link, screenshot, or call transcript into the web app
- 3 screens only: Chat (WhatsApp-style) / Investigation (3 agent cards lighting up in parallel) / Verdict card
- Design language: MRT signage. 20pt min font, red/amber/green, one action per screen, language toggle

### Mell — Evidence & Verdict + trust layer
- VideoDB: upload pre-made deepfake clip **at minute 16** (longest-latency tool), index → transcript → Kimi red-flag pass with timestamps
- SenseNova verdict card (agree card JSON shape with Ade early). Fallback: HTML card, SenseNova for multilingual summary only
- Terminal 3: signed report POST → mock endpoint, show signed receipt
- Nosana: one real model call in triage path, logged visibly in investigation feed

---

## Mobile web reality check (committed design)

- **Cannot access live call audio from the browser.** Do not attempt call capture from the client.
- **Video calls (the deepfake vector):** user uploads or shares a clip/screen recording into the mobile web app → clip feeds VideoDB pipeline
- **Voice calls:** mobile web **panic mode**: 3 giant-font questions ("safe account?", "don't tell family?", "police on video?") → any yes = full-screen HANG UP verdict. No audio access needed, ~1 hour build
- Pitch framing: "We don't eavesdrop on your calls — we triage what you choose to show us." Privacy by design.

---

## The agent contract (agree in first 15 min, whiteboard it)

```json
{ "agent": "link | identity | video", "risk": 0-100, "findings": ["string"], "evidence": {} }
```

Every specialist returns this shape. Everything plugs into it.

## Architecture

```
Frontend (Vite + React mobile web) → POST /investigate → Triage (Kimi via TokenRouter)
  ├─ Link Agent → Daytona sandbox + Bright Data lookups
  ├─ Identity Agent → Bright Data + Nosana (PII scrub)
  └─ Video Agent → VideoDB transcript → Kimi red-flags
       ↓ (findings streamed via SSE to investigation screen)
  Verdict (SenseNova card) → [Report] → Terminal 3 signed filing → mock ScamShield
```

Every agent writes findings to a shared log streamed via SSE — that's what makes the investigation screen feel alive.

---

## Day-of timeline

| Time | Milestone |
|---|---|
| First 15 min | Agree agent JSON contract + card shape. Assign slices. |
| Hour 0–1 | Yeehan: spine with fake verdict. Ade wires mobile web frontend to it immediately. Mell uploads clip to VideoDB. |
| Hour 1–2 | Kimi triage working through TokenRouter. **Checkpoint: working scam classifier = minimum complete demo.** |
| Hour 2–3 | Hosan: sandbox + lookups vs fake phishing page. Mell: transcript red-flag pass. |
| Hour 3–4 | Verdict card + Terminal 3 + Nosana. Ade: mobile web panic mode. |
| 12:30 lunch | Every slice returns correct JSON in isolation. |
| ~2:30 | Yeehan wires real agents into swarm **one at a time**. |
| ~4:00 | **Freeze.** Golden path x5. Record fallback video. Replace anything flaky with pre-recorded clip. |

## De-risking rules

1. Pre-record sandbox detonation + video analysis as fallback clips
2. Mock ScamShield endpoint — say so honestly on stage
3. One golden-path example rehearsed end-to-end; thin but complete beats four half-features
4. No new features after 4:00
5. Real device in hand for demo; mobile web app open on stage

---

## 2-minute pitch skeleton

- **0:00–0:20 Hook:** "$1.1B lost to scams last year. The newest weapon is this—" *(5s deepfake 'police' video call)* "—and the people targeted have nobody to ask."
- **0:20–1:30 Live demo:** Forward scam message + video → swarm fans out on screen → sandbox detonates link → identity check fails → VideoDB flags the call → verdict card: **SCAM — 96%**, readable by a 70-year-old.
- **1:30–1:50 Punchline:** One tap → Terminal 3-verified report filed. "JAGA doesn't just warn — it acts, with cryptographic identity, and the user's data stays private."
- **1:50–2:00 Close:** "Eight production tools, one fraud analyst in every family's pocket. Scammers run swarms. Now so do we."

**Novelty to lead with:** (1) deepfake video-call triage, (2) an agent that acts with verifiable identity rather than just warning.
