"""Plain-language verdict via TokenRouter (Kimi K2.6/K2.7, MiniMax-M3 optional).

Turns the link agent's technical findings into ONE calm sentence a 70-year-old
can act on. The sponsor touchpoint for Kimi: one OpenAI-compatible call.

Fail-soft and env-gated: with no TokenRouter key set, `explain()` returns None and
the caller keeps its own template findings — nothing breaks, no latency added.
TokenRouter is OpenAI-compatible, so this is the standard OpenAI client pointed at
TokenRouter's base URL.

Env (read from .env; the first name found in each group wins, so it works with
either the documented names or the ones already in this repo's .env):
    key    TOKENROUTER_API_KEY   (or TOKEN_ROUTER_API_KEY)
    base   TOKENROUTER_BASE_URL  (or TOKEN_ROUTER_API); default api.tokenrouter.com/v1
    model  KIMI_MODEL or TOKENROUTER_MODEL; default kimi-k2.6
           MINIMAX_M3_MODEL for the optional MiniMax-M3 explainer

Keys come from the environment only — never logged, never on a command line.
"""
import os
import sys

try:
    from openai import OpenAI
except Exception:  # SDK optional — stays importable without it
    OpenAI = None


_DEFAULT_BASE_URL = "https://api.tokenrouter.com/v1"


def _first_env(*names: str) -> str | None:
    """First non-empty value among the given env var names (None if all unset)."""
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def _client():
    key = _first_env("TOKENROUTER_API_KEY", "TOKEN_ROUTER_API_KEY")
    base = _first_env("TOKENROUTER_BASE_URL", "TOKEN_ROUTER_API") or _DEFAULT_BASE_URL
    if not (key and OpenAI):
        return None
    return OpenAI(api_key=key, base_url=base)


_SYSTEM_PROMPT = (
    "You warn elderly Singaporeans about scams. Given the technical "
    "findings, reply with ONE short, calm sentence (max 20 words) that "
    "a 70-year-old can act on. Plain words, no jargon, no preamble. "
    "Never use an em dash or a dash to join clauses; use commas or full stops. "
    "If the findings say a site is the real, verified bank, reassure them it is safe."
)


def _explain_with_model(finding: dict, model: str, label: str) -> str | None:
    """Shared implementation for TokenRouter-backed explainers.

    Kimi models reason by default, and that reasoning is unbounded: it can eat the
    entire token budget and leave `content` empty (finish_reason=length). Raising
    the cap does not fix it (observed 3800+ chars of reasoning). We disable thinking
    so the model answers directly — fast (<1s), cheap (~25 tokens), deterministic.
    A model that refuses to disable thinking (e.g. kimi-k2.7-code) errors out here,
    which is fail-soft to None and lets explain() fall back to the general model.
    """
    client = _client()
    if client is None:
        return None
    facts = "; ".join(finding.get("findings", [])) or "no strong signals found"
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content":
                 f"Risk {finding.get('risk')}/100. Findings: {facts}"},
            ],
            max_tokens=256,  # generous headroom; with thinking off, answers land in ~25
            extra_body={"thinking": {"type": "disabled"}},
            # temperature omitted: some models pin it to 1 and reject other values.
        )
        text = (resp.choices[0].message.content or "").strip()
        usage = getattr(resp, "usage", None)
        if usage:  # the "under a cent per scan" story, logged into the feed
            print(f"[llm] {label} ({model}) via TokenRouter: {usage.total_tokens} tokens",
                  file=sys.stderr)
        return text or None
    except Exception as exc:
        print(f"[llm] {label} explain failed: {exc!r}", file=sys.stderr)
        return None


# General Kimi model — answers reliably with thinking disabled. Used as the
# default and as the fallback when a reasoning-locked model returns nothing.
_FALLBACK_MODEL = "moonshotai/kimi-k2.6"


def explain(finding: dict) -> str | None:
    """One plain sentence on why this is (or isn't) a scam, via Kimi. None if unavailable.

    Tries the configured model, then falls back to the general kimi-k2.6 if the
    configured one returns nothing (e.g. a reasoning-locked model that can't answer
    within budget). This is the "if need be, use kimi-k2.6" safety net.
    """
    primary = _first_env("KIMI_MODEL", "TOKENROUTER_MODEL") or _FALLBACK_MODEL
    summary = _explain_with_model(finding, primary, "Kimi")
    if summary or primary == _FALLBACK_MODEL:
        return summary
    return _explain_with_model(finding, _FALLBACK_MODEL, "Kimi k2.6 fallback")


def explain_minimax(finding: dict) -> str | None:
    """One plain sentence via MiniMax-M3 (optional fallback). None if unavailable."""
    model = _first_env("MINIMAX_M3_MODEL") or "minimax-m3"
    return _explain_with_model(finding, model, "MiniMax-M3")


if __name__ == "__main__":
    import json
    from dotenv import load_dotenv
    load_dotenv()  # self-test convenience; library callers load their own env

    scam = {"risk": 96, "findings": ["Shows a fake DBS login page asking for your password",
                                      "Hosted on a free website service"]}
    safe = {"risk": 0, "findings": ["This is the real, verified DBS website (dbs.com.sg)"]}
    print(json.dumps({
        "configured": _client() is not None,
        "scam_summary": explain(scam),
        "safe_summary": explain(safe),
        "minimax_summary": explain_minimax(scam) if os.environ.get("MINIMAX_M3_MODEL") else None,
    }, indent=2))
