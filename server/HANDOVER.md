# JAGA Link slice — handover (Ade + Yeehan)

**Status: done, live-tested, production-ready.** TokenRouter + Kimi is wired into
the link slice and verified against the real key. 47 tests pass (`0.002s`, no
network). This doc is the delta you each need; full details in `README.md`.

## What changed in this drop

- Every **real** verdict from the link agent now carries an optional `summary`:
  one calm, plain-language sentence written by **Kimi K2.6 via TokenRouter**.
- It is on **both** verdict paths — the scam case *and* the "this is the real
  bank, you're safe" case.
- It is **purely additive**: the four contract keys (`agent`, `risk`, `findings`,
  `evidence`) are untouched. `summary` is simply present or absent.
- Fail-soft: no key, API down, or `JAGA_MOCK=1` → no `summary` key, no crash,
  no added latency. When present it costs <1s and ~150 tokens (well under a cent).

The finding shape:

```json
{
  "agent": "link",
  "risk": 96,
  "findings": ["Shows a fake DBS login page asking for your password", "..."],
  "evidence": { "screenshot": "evidence/detonation_...png", "final_url": "...", "...": "..." },
  "summary": "Do not enter your password, this is a fake DBS website. Call the real bank to check."
}
```

---

## For Ade (frontend / iOS card)

**You render `summary` as the headline line on the verdict card.** It is the
one sentence a 70-year-old can act on — bigger and calmer than the raw findings.

- **Always treat `summary` as optional.** It is absent in mock/offline/key-down
  cases. Fallback order for the headline: `summary` → `findings[0]` → a label
  derived from `risk` (e.g. ≥70 "Likely a scam", <40 "Looks safe").

  ```js
  const headline = finding.summary || finding.findings?.[0] || labelFromRisk(finding.risk);
  ```

- The `findings` array stays your **"why" list** (the bullet evidence under the
  headline). `evidence.screenshot` is the detonation image to show as proof.
- **Language:** `summary` is English. Localisation to 中文 / Melayu is Mell's
  SenseNova U1 layer, which translates this same sentence — so bind the card to
  `summary` and let Mell's layer swap the text. Don't hardcode English copy.
- Real examples you can style against:
  - scam → *"Do not enter your password, this is a fake DBS website. Call the real bank to check."*
  - safe → *"This is the real DBS website, so it is safe to use."*
- **No TokenRouter work for you.** It is entirely server-side. You only read the
  field. (Punctuation is comma/full-stop only — no em dashes — so it wraps clean.)

---

## For Yeehan (spine + brain)

**Nothing about your integration changes.** `investigate_link(url, phone)` returns
the same contract, now with an optional `summary` you may use or ignore.

- For your **verdict explainer**, you can lift the link agent's `summary` straight
  into the consensus output instead of generating your own — it is already the
  plain-language line. Or ignore it and write your own. Your call.
- **TokenRouter lives in the link slice only** (Hosan's decision — not in twilio,
  not auto-applied in the spine). If you *want* the spine to write its own
  explainer via the same gateway, reuse it directly: `from llm import explain`
  (or point your own OpenAI client at `TOKENROUTER_BASE_URL`). Same key.
- **Env the link agent needs from you/Hosan** to emit summaries (else it's
  fail-soft, no summary): `TOKENROUTER_API_KEY`, `TOKENROUTER_BASE_URL`
  (`https://api.tokenrouter.com/v1`), `TOKENROUTER_MODEL=moonshotai/kimi-k2.6`.
  Keys via env only, never committed.
- Dispatch note unchanged: the call is blocking/network-bound (now +<1s for the
  summary). Keep running it in a thread/executor in your parallel swarm, with your
  own ~30s timeout + mock fallback as before.

---

## Gotchas worth knowing (both of you)

- **Model must be `kimi-k2.6`, never `kimi-k2.7-code`.** The code variant forces
  reasoning on, blows the token budget, and returns *empty* answers. `llm.py`
  disables thinking (the real fix) and auto-falls back to `kimi-k2.6` if a
  reasoning-locked model is ever configured. The `.env` is already set correctly.
- The "safe" path (a real bank domain) now makes a ~1s Kimi call too. Intended
  (the model should speak on every verdict). It is fail-soft, so a dead gateway
  just drops the sentence, never the verdict.

Run it yourself: `JAGA_MOCK=1 python link_agent.py https://x.example` (instant, no
keys) or `python llm.py` (live self-test of the summary, needs the key).
