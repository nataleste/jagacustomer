"""dnstwist-style lookalike detection for the link agent.

A brand-new lookalike domain (dbs-com.sg, dbs-secure-verify.vercel.app) sits
in no reported-scam list — it was registered yesterday. You don't look it up,
you detect the pattern: either the hostname is a near-permutation of the real
brand domain, or it carries the brand's name on infrastructure the brand
doesn't own. Pure logic, no network, no keys.
"""
import re
from difflib import SequenceMatcher

# Suffixes where the registrable domain is three labels (kept in sync with
# link_agent.TWO_PART_SUFFIXES; duplicated so this module has no import-time
# dependency on link_agent).
_TWO_PART = {
    "com.sg", "gov.sg", "edu.sg", "org.sg", "net.sg", "per.sg",
    "co.uk", "org.uk", "com.au", "com.my", "com.hk", "co.id", "co.in",
}


def _registrable(host: str) -> str:
    parts = (host or "").lower().strip(".").split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in _TWO_PART:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else (host or "")


def _squash(s: str) -> str:
    """Strip separators so 'dbs-com.sg' and 'dbs.com.sg' compare equal-ish."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _tokens(host: str) -> list[str]:
    """'dbs-secure-verify.vercel.app' -> ['dbs','secure','verify','vercel','app']"""
    return [t for t in re.split(r"[^a-z0-9]+", (host or "").lower()) if t]


def lookalike_score(host: str, brand_domains: dict[str, set[str]]) -> dict | None:
    """Is `host` impersonating a known brand's domain?

    Returns {brand, official, similarity (0-100), contains_brand} for the
    best-matching brand, or None when the host is the genuine domain or
    shows no brand resemblance. Brand-token matches are whole-token only,
    so 'feedbson.com' never trips the DBS check.
    """
    host = (host or "").lower().strip(".")
    registrable = _registrable(host)
    host_tokens = _tokens(host)

    best = None
    for brand, officials in brand_domains.items():
        if registrable in officials:
            return None  # the genuine site, never a lookalike of itself

        for official in officials:
            brand_token = official.split(".")[0]          # 'dbs'
            contains = brand_token in host_tokens
            similarity = round(100 * SequenceMatcher(
                None, _squash(registrable), _squash(official)).ratio())
            if not contains and similarity < 75:
                continue
            candidate = {"brand": brand, "official": official,
                         "similarity": similarity, "contains_brand": contains}
            if best is None or candidate["similarity"] > best["similarity"]:
                best = candidate
    return best
