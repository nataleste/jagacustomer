# TokenRouter + Kimi integration notes (for Yeehan)

> ⚠️ **SUPERSEDED — historical design snapshot.** TokenRouter + Kimi is now
> implemented and live-tested in the link slice: **`kimi-k2.6` with reasoning
> disabled**, a plain-language `summary` on every real verdict, fail-soft.
> The current source of truth is **`HANDOVER.md`** and **`README.md`**.
> Note: the twilio live-call triage proposed below was **dropped** — TokenRouter
> is used in the link slice only, not in twilio or the spine. Ignore §5–§6 here.

This doc is kept only for design history.

## 1. The team-agreed finding schema

`link_agent.py` returns one finding in this shape:

```json
{
  "agent": "link",
  "risk": 0,
  "findings": ["..."],
  "evidence": {}
}
```

The contract keys (`agent`, `risk`, `findings`, `evidence`) are hard boundaries — other slices depend on them.

`summary` is already being added as an **optional** fifth key when TokenRouter is configured (see below). That addition is safe because it is opt-in and does not mutate the required keys.

## 2. Where TokenRouter/Kimi already plug in

### `llm.py` — the client wrapper

- Uses the standard `openai` SDK pointed at TokenRouter's OpenAI-compatible base URL.
- Reads three env vars:
  - `TOKENROUTER_API_KEY`
  - `TOKENROUTER_BASE_URL` (e.g. `https://api.tokenrouter.io/v1`)
  - `KIMI_MODEL` (defaults to `kimi-k2.6`)
- Exposes `explain(finding: dict) -> str | None`.
- Fail-soft: if the key/base/model/client is missing, it returns `None` immediately.

### `link_agent.py` — the optional summary touchpoint

```python
if os.environ.get("TOKENROUTER_API_KEY"):
    try:
        from llm import explain
        summary = explain(finding)
        if summary:
            finding["summary"] = summary
    except Exception:
        pass
```

This means:
- With the env var set: the finding gains a `summary` field.
- Without it: the finding stays exactly on the four-key contract.

### `twilio_ingest.py` — placeholder for the spine

- Currently uses cheap phrase-spotting (`SCAM_PHRASES`) to label each call as `OK / CAUTION / DANGER`.
- Code comments explicitly say the real per-utterance classifier should be TokenRouter/Kimi.

## 3. Gaps / things to decide

| Gap | Question for Yeehan |
|---|---|
| Dependencies | `requirements.txt` does not list `openai`. If you want the summary path to work out of the box, add `openai`. |
| Env vars | `.env.example` only documents Daytona + Bright Data. TokenRouter vars should be documented if they are part of the production setup. |
| Schema docs | `README.md` shows only the four-key shape. If `summary` is staying, the README should mention it. |
| Live-call triage | `twilio_ingest.live_suspicion()` is still phrase-spotting. Do you want Kimi to classify the running transcript, or should that stay in the spine? |
| Cost/latency | `llm.explain()` is one LLM call per link finding. For live calls with many utterances, a Kimi triage call per utterance could add latency/cost. Consider batching or only classifying on final transcripts. |

## 4. Suggested minimal integration (if you want to proceed)

1. Add `openai` to `requirements.txt`.
2. Add these three lines to `.env.example`:
   ```
   TOKENROUTER_API_KEY=
   TOKENROUTER_BASE_URL=https://api.tokenrouter.io/v1
   KIMI_MODEL=kimi-k2.6
   ```
3. Update `README.md` schema to show the optional `summary` key and document the env vars.
4. Keep `link_agent.py` summary logic as-is (it is already gated and fail-soft).
5. Decide on `twilio_ingest.py`:
   - Option A: leave phrase-spotting as the prototype fallback and let the spine handle Kimi triage.
   - Option B: add `llm.classify_call(transcript)` that returns `(level, reasons)` and make `live_suspicion()` prefer Kimi, falling back to phrase spotting.

## 5. If Option B (Kimi live-call triage)

A new helper in `llm.py` could look like:

```python
def classify_call(transcript: str) -> tuple[str | None, list[str]]:
    """Kimi-based live-call triage. Returns (level, reasons); (None, []) if unavailable."""
    client = _client()
    if client is None:
        return None, []
    model = os.environ.get("KIMI_MODEL", "kimi-k2.6")
    # ... call TokenRouter, parse OK/CAUTION/DANGER ...
```

Then `twilio_ingest.py` would:

```python
def live_suspicion(transcript: str) -> tuple[str, list[str]]:
    level, reasons = classify_call(transcript)
    if level is not None:
        return level, reasons
    # fallback to existing phrase spotting
```

This keeps the demo working without keys and upgrades to Kimi when keys are present.

## 6. Files involved

- `link-agent/link_agent.py`
- `link-agent/llm.py`
- `link-agent/twilio_ingest.py`
- `link-agent/requirements.txt`
- `link-agent/.env.example`
- `link-agent/README.md`
- `link-agent/test_link_agent.py`
- `link-agent/test_twilio_ingest.py`
