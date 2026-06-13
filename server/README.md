# JAGA — Link agent (Hosan's slice)

Investigates a suspicious URL and returns one finding in the team-agreed shape:

```json
{ "agent": "link", "risk": 0, "findings": ["..."], "evidence": {} }
```

When TokenRouter is configured, every real verdict also carries an optional
plain-language `summary` — one calm sentence for the card, e.g.
`"Do not enter your password, this is a fake DBS website. Call the real bank to check."`
The four contract keys never change; `summary` is purely additive (and absent in
`JAGA_MOCK` mode).

## Integration (Yeehan)

```python
from link_agent import investigate_link
finding = investigate_link(url, phone)   # phone is optional
```

No keys handy? `JAGA_MOCK=1` returns a canned valid finding instantly.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in the keys — never commit .env
```

Required: `DAYTONA_API_KEY`, `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_ZONE`.
Optional (the Kimi summary): `TOKENROUTER_API_KEY`, `TOKENROUTER_BASE_URL`
(`https://api.tokenrouter.com/v1`), and `TOKENROUTER_MODEL=moonshotai/kimi-k2.6`.
`llm.py` disables the model's reasoning so the sentence is fast (<1s),
deterministic, and never empties the token budget. **Use `kimi-k2.6`, not
`kimi-k2.7-code`** — the code model forces reasoning on and returns empty answers;
if one is ever configured, `explain()` auto-falls back to `kimi-k2.6`.

## Run

```bash
python link_agent.py https://dbs-secure.vercel.app +6591234567   # → HIGH
python link_agent.py https://www.dbs.com.sg                             # → LOW (the test that matters)
python -m unittest discover -p 'test_*.py'                              # 47 tests
```

## Signals → risk (weights in `WEIGHTS`, tune there)

| Signal | Weight | Source |
|---|---|---|
| Fake brand login page | +50 | Daytona sandbox detonation (screenshot + HTML) |
| Domain registered < 30 days | +30 | Registry RDAP, direct via IANA bootstrap (Bright Data fallback) |
| On scam-report sites | +25 | Bright Data (2 lookups: domain, phone) |
| Cross-domain redirects | +15 | Daytona redirect chain |
| Free-hosting subdomain | +30 | replaces the age check on vercel.app etc. |

Every signal fails soft: a dead API adds a plain-language note to `findings`,
never a crash. The untrusted URL is only ever loaded **inside** the Daytona
sandbox (`daytona_detonate.py`), never in this process.

## Live-call intake (Twilio)

Customer three-way-merges our Twilio number into the suspicious call;
Twilio transcribes in real time and POSTs utterances here.

```bash
uvicorn twilio_ingest:app --port 8035     # the webhook server
ngrok http 8035                           # public tunnel
python twilio_setup.py https://x.ngrok.app  # verify account (trial check!) + wire webhook
```

Needs in `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY` (auth token),
`TWILIO_PHONE_NUMBER`, `PUBLIC_BASE_URL` (the ngrok URL).
Live state per call: `GET /call/{call_sid}` — transcript, OK/CAUTION/DANGER,
artifacts, link-agent findings. Phrase-spotting is a placeholder; the real
triage belongs to the spine (TokenRouter/Kimi or MiniMax-M3).

## Detonation target

https://dbs-secure.vercel.app — our own controlled fixture
(noindex, collects nothing). Never detonate a real scam link in demos.
