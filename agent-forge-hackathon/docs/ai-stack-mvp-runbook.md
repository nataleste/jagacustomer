---
summary: Runbook for the AI Stack MVP Lab, with one minimum presentable demo per Agent Forge stack tool.
read_when:
  - Running the hackathon meeting demo.
  - Wiring real sponsor credentials into the MVP adapters.
  - Explaining which stack capability each demo proves.
---

# AI Stack MVP Runbook

## Contents

- [Run Locally](#run-locally)
- [Demo Map](#demo-map)
- [Credential Hooks](#credential-hooks)
- [Meeting Flow](#meeting-flow)
- [Known Boundaries](#known-boundaries)

## Run Locally

Install dependencies:

```sh
npm install
```

Start the API and web app:

```sh
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

Health check:

```sh
curl http://localhost:8787/api/health
```

## Demo Map

| Stack tool | MVP | What it proves |
| --- | --- | --- |
| Kimi AI | Long-context brief distiller | A model brain can turn noisy product context into a scoped build plan. |
| Bright Data | Market signal scout | Live public web data can feed an evidence-backed agent workflow. |
| Daytona | Sandboxed script runner | The agent can execute generated code in a controlled worker path. |
| Nosana | GPU job planner | Heavy inference or media processing can be moved to scheduled GPU compute. |
| SenseNova U1 | Receipt and scene analyst | Multimodal extraction can turn visual evidence into policy-relevant facts. |
| SenseNova Skills | One-click judge packet | Agent findings can become polished decks, tables, infographics, or research artifacts. |
| Terminal 3 | Delegated authority receipt | Scoped consent, identity, limits, expiry, and audit state are visible before action. |
| VideoDB | Timestamp evidence finder | Video can become searchable evidence with clip-ready timestamps. |

## Credential Hooks

The app does not read `.env` files. Export keys in the shell before running the dev server.

| Variable | Used by | Current behavior |
| --- | --- | --- |
| `KIMI_API_KEY` or `MOONSHOT_API_KEY` | Kimi AI | Calls Moonshot's OpenAI-compatible chat API through the OpenAI Node SDK. |
| `KIMI_BASE_URL` | Kimi AI | Optional override, defaults to `https://api.moonshot.ai/v1`. |
| `KIMI_MODEL` | Kimi AI | Optional override, defaults to `kimi-k2.6`. |
| `VIDEODB_API_KEY` | VideoDB | Reserved for replacing the seeded timestamp result with VideoDB SDK/API calls. |
| `DAYTONA_API_KEY` | Daytona | Reserved for replacing the local VM stand-in with a Daytona sandbox. |

For local shell runs, export VideoDB credentials in the terminal that starts the backend or bridge:

```sh
export VIDEODB_API_KEY="..."
```

For deployed Supabase Edge Functions, set the same value as a Supabase secret:

```sh
supabase secrets set VIDEODB_API_KEY="..."
```

Do not put sponsor keys in `.env` files for this demo thread. If `VIDEODB_API_KEY` is unavailable, the `videodb-index` path keeps using seeded timestamp evidence so the presentation still works.

## Recording Playback Happy Path

For the 1pm demo, treat VideoDB as media indexing and evidence intelligence, not the canonical recording vault.

```text
Twilio RecordingUrl
  -> recordings metadata row / local bridge recording event
  -> VideoDB timestamp evidence
  -> mobile UI audio playback + VideoDB moment buttons
```

The local bridge includes a deterministic happy-path trigger:

```sh
curl -X POST http://127.0.0.1:8787/demo/happy-path
```

If a browser-playable Twilio recording URL is available, pass it into the trigger:

```sh
curl -X POST http://127.0.0.1:8787/demo/happy-path \
  -H "content-type: application/x-www-form-urlencoded" \
  --data-urlencode "RecordingUrl=https://example.com/recording.mp3"
```

Fallback: run the same trigger without `RecordingUrl`. The bridge serves a local generated demo recording at `/demo/recording.wav`, so the UI still shows completed recording state, transcript risk tags, playable audio, and three VideoDB timestamped evidence moments.

## Meeting Flow

1. Start on Kimi AI and show how a messy brief becomes a scoped agent plan.
2. Move to Bright Data to explain where public evidence enters the workflow.
3. Run Daytona to show execution rather than chat-only behavior.
4. Use Terminal 3 to show identity, consent, and scoped authority.
5. Use VideoDB and SenseNova U1 to show media and multimodal evidence.
6. Close with SenseNova Skills and Nosana as the polish and scale-out layers.

## Known Boundaries

- Most panels are keyless MVPs with adapter seams, not full sponsor-account integrations.
- Daytona currently uses a local Node VM expression runner as the presentable execution stand-in.
- Terminal 3 public docs describe Agent Auth and Agent Dev Kit positioning, but the SDK/API surface still needs hackathon access before true signing/verifying can replace the local authorization object.
- SenseNova Skills are represented as artifact-production plans until the hackathon provides the exact callable endpoints or templates.
