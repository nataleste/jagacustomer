# JAGA — Architecture & Deployment Spec

*AgentForge SG hackathon · drafted 2026-06-11 · working engineering doc*

JAGA is an AI fraud analyst. A user submits something suspicious (a message, a link, a
screenshot, a call recording); a swarm of verifier agents investigates in parallel; their
findings combine into a verdict; on a SCAM verdict, Terminal3 files a report on the user's
behalf. Verdicts stream to the browser live.

---

## 1. Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Idea | JAGA (scam analyst), pivoted from Proofwork | National pain, 8/8 sponsors, demoable |
| Swarm runtime | **No Kimi.** Parallel calls, orchestrated in-app | Drop the untested dependency; `Promise.all` is enough |
| Model routing | **TokenRouter** for every model call | Sponsor criterion + cheap-triage/escalate routing |
| Interface | **Web app, not Telegram** | Dev familiarity; richer submit + live swarm UI |
| Input scope | text + url + image + call recording | Full sponsor coverage |
| Deploy | **Vercel first**, port to Daytona if it all works | Dev knows Vercel; Daytona is a Phase-2 upgrade |
| Detonation | **urlscan.io API (Phase 1) → Daytona sandbox (Phase 2)** | Never render live phishing HTML in our own runtime |

The detonation decision is what lets Phase 1 run entirely on Vercel: urlscan does the dangerous
page-load on its own infrastructure and returns a screenshot over HTTP.

---

## 2. The protocol: one uniform agent contract

The whole "swarm" is N functions sharing one signature. Adding a checker = writing one file
that returns a `Finding`. There is no orchestration framework.

```ts
// lib/types.ts
type Case = {
  id: string
  text?: string            // pasted message / SMS
  url?: string             // suspicious link
  image?: string           // uploaded screenshot (blob URL / storage key)
  media?: string           // uploaded call recording
  lang?: 'en' | 'zh' | 'ms'
}

type Finding = {
  agent: string                          // 'lookalike'
  signal: string                         // "Registered 3 days ago"  ← shown on screen
  verdict: 'scam' | 'safe' | 'unknown'
  confidence: number                     // 0..1
  weight: 'hard' | 'soft'                // hard = can decide alone; soft = contributory
  evidence: { kind: 'screenshot' | 'whois' | 'link' | 'quote'; value: string }[]
  source: string                         // 'RDAP', 'eth-phishing-detect'  ← the citation
  ms: number                             // latency, for the live feed
}

type Verdict = {
  label: 'scam' | 'likely-scam' | 'unclear' | 'safe'
  confidence: number
  explainer: string                      // plain-language, multilingual
  topFindings: Finding[]
}
```

```ts
// lib/agents/index.ts — the orchestrator
type Agent = (c: Case) => Promise<Finding | Finding[]>

export async function* runSwarm(c: Case): AsyncIterable<Finding> {
  const agents = pickAgents(c)   // url → link + lookalike; image → visual;
                                 // media → call; always → narrative + identity
  for await (const f of mergeParallel(agents.map(a => a(c)))) yield f
}
```

The `async function*` is the demo's drama: each `Finding` is pushed to the browser over SSE the
instant its agent returns, so the swarm visibly fans out on screen.

---

## 3. The agents

Each is one file in `lib/agents/`. All are HTTP calls in Phase 1.

| Agent | Fires on | Does | Sources | Hard signal? |
|---|---|---|---|---|
| `narrative` | always | LLM reads the text for social-engineering patterns (urgency, gift cards, "police", payment links) | TokenRouter | soft |
| `lookalike` | url | permutations + which resolve + domain age + fuzzylist match | DNS-over-HTTPS, RDAP, eth-phishing-detect | **hard** |
| `identity` | always | does the claimed company/number exist; is it on a watchlist | ACRA (data.gov.sg), MAS Investor Alert, Bright Data | **hard** |
| `link` | url | detonate the URL, get a screenshot + final URL + reputation | **urlscan.io** (P1) / Daytona worker (P2), Safe Browsing, URLhaus | **hard** |
| `visual` | image | visual diff of the suspect page/screenshot vs the real brand | SenseNova U1 | soft |
| `call` | media | ingest recording → transcript → LLM reads for scam script | VideoDB → TokenRouter | soft |

`narrative`, `call`, the `visual` reasoning, and the final `explainer` all route through
`lib/tokenrouter.ts`. Before any text/transcript leaves to a cloud model, `lib/nosana.ts`
scrubs PII (names, NRIC, phone, account numbers) — a real privacy job and Nosana's slot.

---

## 4. Consensus — the team authors this

Everything else is mechanical. The consensus rule is JAGA's actual judgment and has no single
right answer, so the team writes it (~8 lines).

```ts
// lib/consensus.ts
//  Combine findings into a verdict. The real calls:
//   • Does ONE hard scam signal (on fuzzylist, domain 3 days old) suffice to stamp SCAM,
//     or do you require two?
//   • Do 'safe' signals (valid cert, aged domain, in ACRA) VETO a hard scam signal,
//     or just lower the score? (false-positive trade-off)
//   • Do several 'soft' signals (urgency + gift card + "police") sum to a hard call?
export function consensus(findings: Finding[]): Verdict {
  // TODO(team): your rule here. This is the brain.
}
```

**Recommended default** (use unless the team decides otherwise): any one `hard` scam signal ⇒
`scam`; otherwise soft scam signals accumulate (each +0.15, cap 0.9) and safe signals subtract;
≥0.7 ⇒ `likely-scam`, ≥0.4 ⇒ `unclear`, else `safe`. A valid ACRA match does **not** auto-veto
a fuzzylist hit (scammers register real shell companies) — it only adds a safe signal.

---

## 5. Frontend

One hero screen, audit-grade fintech aesthetic (see the team deck). Three regions:

- `SubmitPanel` — text box + url field + image upload + recording upload. One "Investigate" button.
- `SwarmFeed` — subscribes to the SSE stream; renders each `Finding` as it lands (agent name,
  signal, source citation, latency). This is the live fan-out.
- `VerdictCard` — the consensus `Verdict`. The red **SCAM · NN%** stamp lands here (the one
  micro-interaction). Shows the explainer + top findings with citations.
- `ReportPanel` — appears on a scam verdict. One button → `POST /api/report`.

Stack: Next.js (App Router) + Tailwind + shadcn (re-tokened, not defaults) + Framer Motion for
the stamp only. SSE via a Next.js route returning a `ReadableStream`.

---

## 6. Deployment

### Phase 1 — Vercel only (the build target for Saturday)

```
Browser ──▶ Vercel (Next.js app + API routes)
                 ├─ /api/investigate  → runSwarm → SSE back to browser
                 │     agents = HTTP calls: urlscan, RDAP, ACRA, MAS,
                 │     Safe Browsing, VideoDB, SenseNova, TokenRouter, Bright Data
                 └─ /api/report       → Terminal3 → SingCERT (sandbox inbox)
```

- One `vercel deploy`. Stable HTTPS URL for the 2-minute demo. SSE runs on Vercel Fluid functions.
- The Link agent's detonation = urlscan.io API. **Nothing unsafe or long-running in our functions.**
- The staged phishing site (demo target) = a separate throwaway Vercel/static deploy we control.
  Never a real scam link.

### Phase 2 — port to Daytona (stretch, only if Phase 1 is solid)

- Stand up a Daytona sandbox running `worker/server.ts` (Node + Playwright). Exposes `POST /detonate`.
- Swap `lib/agents/link.ts` from the urlscan adapter to the Daytona adapter via one env var
  (`DETONATION_MODE=daytona`, `DETONATION_URL=...`). **Nothing else changes.**
- Upgrade gained: our own sandboxed render + dnstwist's HTML fuzzy-hash (visual-similarity score).
- The app itself can also `next start` on a Daytona box or the Mac mini unchanged — Vercel is
  convenience, not lock-in.

### Secrets — env only, never inline

`TOKENROUTER_KEY`, `URLSCAN_KEY`, `SAFE_BROWSING_KEY`, `VIRUSTOTAL_KEY`, `URLHAUS_KEY`,
`BRIGHT_DATA_*`, `VIDEODB_KEY`, `SENSENOVA_KEY`, `TERMINAL3_*`, `DETONATION_URL`.
All in `.env.local` (gitignored) and Vercel project env. No key ever appears on a command line.

---

## 7. Repo

```
jaga/
  app/
    page.tsx                       SubmitPanel · SwarmFeed · VerdictCard · ReportPanel
    api/investigate/route.ts       POST → runSwarm, returns SSE stream
    api/report/route.ts            POST → Terminal3 files to SingCERT-sandbox
  lib/
    types.ts                       Case · Finding · Verdict
    agents/
      index.ts                     registry, pickAgents, runSwarm, mergeParallel
      narrative.ts lookalike.ts identity.ts link.ts visual.ts call.ts
    consensus.ts                   ← team authors
    tokenrouter.ts nosana.ts terminal3.ts
    sources/                       thin clients: urlscan, rdap, acra, mas, safebrowsing, fuzzylist
  components/                      SubmitPanel SwarmFeed VerdictCard ReportPanel
  worker/                          Phase 2 only — deploys to Daytona
    server.ts detonate.ts
  .env.local
```

---

## 8. Build order (mock-first, so the demo always works)

1. `types.ts` + agent contract + `runSwarm` with **mock agents** (return fake findings on a timer).
2. `SubmitPanel` + `SwarmFeed` + `VerdictCard` wired to the SSE stream. **Demo works end-to-end on mocks.**
3. Replace mocks with real agents one at a time: `link` (urlscan) → `lookalike` → `identity` →
   `narrative` → `visual` → `call`.
4. `consensus.ts` — the team's rule.
5. `terminal3.ts` + `ReportPanel` (file to sandbox inbox).
6. Polish the hero screen; rehearse.
7. *(Stretch)* Daytona worker + swap `link.ts`.

Mock mode is the safety net: if any integration breaks on Saturday, that agent falls back to its
mock and the demo still runs.

---

## 9. Demo-day topology

- App: Vercel (stable URL).
- Detonation: urlscan.io.
- Staged phishing site: our own throwaway deploy.
- Report filing: SingCERT **sandbox** inbox (real channel shown, real submission withheld).
- Backup: a muted screen recording on a second laptop; every agent has a mock fallback.

---

## 10. Open questions for the team

- **Consensus veto rule** (§4) — confirm the default or write your own.
- **Report receipt contents** — what the Terminal3-signed receipt shows (case id, evidence hashes,
  timestamp, agent identity). Also a small team-authored decision.
- **Storage** for uploaded image/recording — Vercel Blob is the path of least resistance; confirm.
- **Which staged scam** is the hero demo (fake-DBS SMS + lookalike link is the current plan).
