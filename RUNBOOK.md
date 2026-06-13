# JAGA — Runbook (run · build · deploy · demo)

Operational reference. If you only read one file to get this running, read this.

## Repos & live URLs
- **Front-end repo:** `github.com/nataleste/jagacustomer` (and mirror `github.com/nataleste/jaga`), branch `main`. Local: `~/projects/jaga-app`.
- **Deployed app (front-end):** https://jagacustomer.vercel.app  (Vercel, auto-deploys on push to `main`)
- **Deployed engine (backend):** https://jaga-link-agent.onrender.com  (Render, free)
- **Main dev's separate Userflow-1 app:** https://jaga-mobile-web.vercel.app (different codebase; branding aligned manually).

## Architecture (the key mental model)
Two halves that talk over HTTP:
- **Front-end** = the screens (React + Vite + Tailwind). Hosted on Vercel. No brain.
- **Backend ("engine")** = Python FastAPI link agent: Daytona detonation + Bright Data + Kimi. Hosted on Render. No UI.
- The front-end calls the backend. **Dev:** Vite proxies `/api/*` → `localhost:8000`. **Prod:** front-end reads env var **`VITE_API_URL`** = the Render URL. If the backend is unreachable, the app **falls back to a static demo** (so it never crashes — but shows mock, not real).

## Run locally
**Backend** (needs Python 3.10+; live keys required for real results):
```bash
cd ~/projects/jaga-app/server          # OR ~/projects/jaga-design/jaga-link-slice (Hosan's source)
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env                   # paste the 6 keys (see Secrets below)
./.venv/bin/uvicorn api:app --port 8000
# health check → http://localhost:8000/api/health  → {"ok":true,"mock":false}
```
**Front-end:**
```bash
cd ~/projects/jaga-app
npm install
npm run dev        # http://localhost:5173  (proxies /api → :8000 automatically)
```
Mock mode (no keys, instant canned result): run the backend with `JAGA_MOCK=1`.

## Deploy
- **Front-end → Vercel:** push to `main` → auto-deploys. `vercel.json` has the SPA rewrite (so routes like `/investigation` don't 404 — do not remove it).
- **Backend → Render:** `render.yaml` is a Blueprint. Render → New + → Blueprint → pick repo → paste the 6 secret env vars → Apply.
- **Connect them:** Vercel → jagacustomer → Settings → Environment Variables → `VITE_API_URL = https://jaga-link-agent.onrender.com` (base, no `/api`) → **Redeploy**.

## Demo / warm-up (IMPORTANT)
- Render free **sleeps after ~15 min idle** → first request ~50s cold start. **Before presenting, open** `https://jaga-link-agent.onrender.com/api/health` once to wake it.
- A real link check takes **~25–30s** (Daytona sandbox) — that "thinking" is expected, not a hang.
- To show the **real** flow on the deployed app: open the site → **"Check a message or link"** → tap **"Try scam link → dbs-secure.vercel.app"** → Send. (Tapping `/investigation` directly shows static.)
  - `https://dbs-secure.vercel.app/` → real scam verdict (risk ~96) + captured screenshot.
  - `https://www.dbs.com.sg` → safe (risk 0).

## Secrets (NOT in git)
Backend needs these 6 env vars. Live values are in `~/projects/jaga-design/jaga-link-slice/.env` (and Render's dashboard):
`DAYTONA_API_KEY`, `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_ZONE`, `TOKENROUTER_API_KEY`, `TOKENROUTER_BASE_URL`, `TOKENROUTER_MODEL`.
> ⚠️ Never commit `.env` / `env`. (terminal3's `.env` also holds an Ethereum private key — keep out of git.)

## Sponsor tools → where each lives
| Tool | File |
|---|---|
| Daytona (detonate link) | `server/daytona_detonate.py` |
| Bright Data + data.gov.sg/ACRA (reputation, domain age) | `server/reputation.py`, `server/link_agent.py` |
| Kimi K2.6 + TokenRouter (verdict/swarm) | `server/llm.py` |
| Terminal 3 (evidence seal, did:t3n) | `src/lib/t3.js`, `src/screens/Sealing.jsx` |
| Front-end ↔ backend bridge | `src/lib/jaga.js`, `src/screens/Investigation.jsx` |

## Key front-end files
- `src/index.css` — design tokens (single source of truth) + the **G1 rule** (red/amber/green = verdict only; CTAs black; status text gray).
- `src/App.jsx` — routes (see also `routing-spec.md` in jaga-design). `src/components/PhoneFrame.jsx` — device frame + Back/Home controls + dark mode.
- Screens in `src/screens/`. Verdict is one component with `scam`/`careful`/`safe` variants.

## Pitch deck
Built in Paper (not in repo). Exported: `~/Downloads/JAGA-pitch-deck.pdf` and `~/Downloads/JAGA-slides/*.png`. Re-export from Paper after edits.
