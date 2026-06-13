"""Bright Data reputation fan-out.

The Bright Data showcase: query MANY authoritative scam-report sources at once
— SG police & regulators (SPF, MAS, ScamShield, NCPC), AU Scamwatch, and the
threat-intel feeds (PhishTank, OpenPhish, URLhaus, CheckPhish), with ScamAdviser
unlocked directly — and read each for a verdict on our target domain or phone
number. A dozen sources of truth, in parallel, in seconds.

The decisive leg is the live OpenPhish feed: we pull its ~300 active phishing
URLs through Bright Data and match the target's registrable domain against them,
so a genuinely-reported bank/government impersonation flags with certainty —
not by hoping Google indexed a report page, but by direct membership.

Why structured SERP, not raw HTML: an unlocked Google page is chrome, JS and
anti-scrape soup — substring matching on it flags everything (even wikipedia).
Bright Data's SERP API (`brd_json=1`) returns parsed organic results — title,
link, description — so we read real results, not page furniture.

Verdict-aware on purpose. Breadth is the show; a HIT needs real signal: a low
ScamAdviser trust score, or an organic result that comes FROM a scam-report
domain and names our target. "dbs.com.sg" appearing on DBS's own anti-scam
page is not a report — so we key on the result's source domain, not on the
word 'scam' sitting near the term.

Keys come from .env only, read inside this process — never logged, never on a
command line.
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus, urlparse

import requests

BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request"

# ScamAdviser auto-generates a page for EVERY domain, so the page existing is
# not a report. Only a low trust score is. ≥ threshold = benefit of the doubt.
TRUST_THRESHOLD = 50

# Turn a neutral mention into a scam report when next to the term, in the
# narrow community-result case. Excludes the brand name itself.
SCAM_KEYWORDS = ("scam", "phishing", "fraud", "fake", "cheat", "victim",
                 "lost money", "stole", "spoof", "impersonat", "do not")

# SOURCES OF TRUTH — official regulators, police, and established threat-intel
# feeds. An organic result FROM one of these naming our target is a real
# listing. Deliberately excludes (a) auto-review aggregators like
# scamadviser/scam-detector that mint a page for EVERY domain, and (b) general
# community platforms (reddit, HardwareZone, Carousell) where every domain and
# number gets discussed without it being a report.
REPORT_DOMAINS = (
    "scamalert.sg",        # NCPC Scam Alert (SG)
    "scamshield.gov.sg",   # ScamShield — SG gov anti-scam
    "police.gov.sg",       # Singapore Police Force scam bulletins
    "mas.gov.sg",          # MAS Investor Alert List
    "ncpc.org.sg",         # National Crime Prevention Council
    "scamwatch.gov.au",    # ACCC Scamwatch (AU)
    "bbb.org",             # BBB Scam Tracker (intl)
    "checkphish.ai",       # CheckPhish — AI phishing detection
    "urlvoid.com",         # URLVoid multi-engine reputation
    "phishtank.com",       # PhishTank community phishing feed
    "openphish.com",       # OpenPhish intelligence feed
    "urlhaus.abuse.ch",    # URLhaus malware-distribution URLs
)

# Authoritative sources we site-search directly. These publish curated scam
# bulletins / alert lists — a scam-framed result naming our target is real
# signal, not forum chatter. ScamAdviser is fetched directly for its numeric
# trust score; the rest go through the SERP API.
DOMAIN_SOURCES = [
    {"name": "OpenPhish Feed", "kind": "phish_feed"},
    {"name": "ScamAdviser", "kind": "scamadviser"},
    {"name": "ScamAlert SG", "kind": "site_search", "site": "scamalert.sg"},
    {"name": "SPF Scam Bulletin", "kind": "site_search", "site": "police.gov.sg"},
    {"name": "MAS Alert List", "kind": "site_search", "site": "mas.gov.sg"},
    {"name": "CheckPhish", "kind": "site_search", "site": "checkphish.ai"},
    {"name": "Threat registries", "kind": "web_reports"},
]
PHONE_SOURCES = [
    {"name": "ScamAlert SG", "kind": "site_search", "site": "scamalert.sg"},
    {"name": "SPF Scam Bulletin", "kind": "site_search", "site": "police.gov.sg"},
    {"name": "WhoCalledMe SG", "kind": "site_search", "site": "whocalledme.com.sg"},
    {"name": "Threat registries", "kind": "web_reports"},
]

MAX_FETCHES = 12  # hard cap on Bright Data calls per investigation

# Shared-hosting registrable domains: many unrelated tenants live under one of
# these, so a sibling phishing subdomain says nothing about another tenant. The
# feed leg must never flag the registrable domain itself for these. (Phishing
# feeds are full of these platforms — keep this list current.)
SHARED_HOSTS = {
    # static / app hosting
    "vercel.app", "netlify.app", "github.io", "pages.dev", "web.app",
    "firebaseapp.com", "glitch.me", "wixsite.com", "weebly.com", "repl.co",
    "replit.app", "godaddysites.com", "blogspot.com", "herokuapp.com",
    "sites.google.com", "onrender.com", "surge.sh", "fly.dev", "r2.dev",
    # tunnels / serverless edges (rampant in live phishing feeds)
    "workers.dev", "trycloudflare.com", "framer.website", "framer.app",
    "notion.site", "carrd.co", "canva.site", "my.canva.site", "bubbleapps.io",
    "azurewebsites.net", "amplifyapp.com", "webflow.io", "durable.co",
}

# Suffixes where the registrable domain is three labels (e.g. dbs.com.sg).
_TWO_PART = {"com.sg", "gov.sg", "edu.sg", "org.sg", "net.sg", "co.uk",
             "org.uk", "com.au", "com.my", "com.hk", "co.id", "co.in"}

_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def _stage(msg: str) -> None:
    print(f"  → {msg}", file=sys.stderr, flush=True)


def _clip(s: str, n: int = 200) -> str:
    return re.sub(r"\s+", " ", s or "").strip()[:n]


def _result_domain(result: dict) -> str:
    link = result.get("link") or result.get("display_link") or ""
    return (urlparse(link).hostname or link).lower()


def _mentions(text: str, term: str) -> bool:
    """Whole-token match: 'example.com' must not match inside 'resume-example.com',
    nor a phone fragment inside a longer number."""
    return re.search(r"(?<![\w.-])" + re.escape(term) + r"(?![\w-])",
                     text or "", re.I) is not None


def _registrable(host: str) -> str:
    parts = (host or "").lower().strip(".").split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in _TWO_PART:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else (host or "")


def match_phish_feed(term: str, feed_hosts: set) -> str | None:
    """Is `term` (a domain) currently listed in the live phishing feed?

    Matches on the registrable domain so a listed sub-host (e.g.
    staging.x.evil.com) flags the parent (evil.com). But a shared-hosting
    registrable (vercel.app, godaddysites.com…) is never matched — a sibling
    phishing subdomain there says nothing about an unrelated tenant. Returns
    the matching feed host, or None.
    """
    reg = _registrable(term)
    if not reg or reg in SHARED_HOSTS:
        return None
    for h in feed_hosts:
        if h == term or _registrable(h) == reg:
            return h
    return None


# ----------------------------------------------------------------- parsers ----

def parse_scamadviser(html: str, term: str) -> dict | None:
    """Direct ScamAdviser verdict: a trust score below the threshold is a hit."""
    score = None
    for pattern in (
        r'"ratingValue"\s*:\s*"?(\d{1,3})"?',
        r'(?:trust\s*score|trustscore)[^0-9]{0,40}(\d{1,3})\s*(?:/|out of|%)',
        r'\b(\d{1,3})\s*/\s*100\b',
    ):
        m = re.search(pattern, html or "", re.I)
        if m:
            score = int(m.group(1))
            break
    if score is None or score > 100 or score >= TRUST_THRESHOLD:
        return None
    return {"trust_score": score,
            "snippet": f"ScamAdviser rates this site {score}/100 — very low trust"}


def parse_serp_community(organic: list, term: str) -> dict | None:
    """Site-restricted search: a hit needs ONE organic result that names the
    term AND carries a scam keyword in its own title/description."""
    for r in organic or []:
        blob = f"{r.get('title', '')} {r.get('description', '')}"
        if _mentions(blob, term) and any(k in blob.lower() for k in SCAM_KEYWORDS):
            return {"snippet": _clip(f"{r.get('title', '')} — {r.get('description', '')}"),
                    "link": r.get("link")}
    return None


def parse_serp_reports(organic: list, term: str) -> list[dict]:
    """Broad search: a hit is an organic result FROM a known scam-report domain
    that names our target. Keyed on source domain, not keyword proximity — so
    the target's own brand page (e.g. DBS's anti-scam advisory) never counts."""
    hits, seen = [], set()
    for r in organic or []:
        dom = _result_domain(r)
        blob = f"{r.get('title', '')} {r.get('description', '')} {r.get('link', '')}"
        if not _mentions(blob, term):
            continue
        for site in REPORT_DOMAINS:
            if site in dom and site not in seen:
                hits.append({"source": site,
                             "snippet": _clip(f"{r.get('title', '')} — {r.get('description', '')}"),
                             "link": r.get("link")})
                seen.add(site)
                break
    return hits


# ------------------------------------------------------------- the fan-out ----

def _fetch(target_url: str, fmt: str = "raw") -> str:
    api_key = os.environ["BRIGHT_DATA_API_KEY"]
    zone = os.environ["BRIGHT_DATA_ZONE"]
    r = requests.post(BRIGHTDATA_ENDPOINT,
                      json={"zone": zone, "url": target_url, "format": fmt},
                      headers={"Authorization": f"Bearer {api_key}"}, timeout=90)
    r.raise_for_status()
    return r.text


def _fetch_serp(query: str) -> list:
    """Bright Data SERP API → parsed organic results (title/link/description)."""
    url = f"https://www.google.com/search?q={quote_plus(query)}&brd_json=1&num=20"
    return json.loads(_fetch(url)).get("organic", [])


_FEED_CACHE = {}


def _phish_feed_hosts() -> set:
    """The live OpenPhish community feed (~300 active phishing URLs) as a set of
    hosts. Fetched once per process through Bright Data (with a direct fallback),
    so it costs one unlock no matter how many targets we check."""
    if "openphish" in _FEED_CACHE:
        return _FEED_CACHE["openphish"]
    raw = ""
    try:
        raw = _fetch("https://openphish.com/feed.txt")
    except Exception as exc:
        print(f"[reputation] OpenPhish via Bright Data failed: {exc!r}", file=sys.stderr)
    if "http" not in raw:  # unlock empty/blocked — go direct
        try:
            raw = requests.get("https://openphish.com/feed.txt",
                               headers={"User-Agent": _UA}, timeout=30).text
        except Exception as exc:
            print(f"[reputation] OpenPhish direct fetch failed: {exc!r}", file=sys.stderr)
    hosts = {(urlparse(line.strip()).hostname or "").lower()
             for line in (raw or "").splitlines()}
    hosts.discard("")
    _FEED_CACHE["openphish"] = hosts
    return hosts


def _check(source: dict, term: str, target_kind: str) -> dict:
    """Run one source. Always returns a record (for the 'checked N sources'
    story); 'hit' is True only on real signal. Fail-soft per source."""
    rec = {"source": source["name"], "target": target_kind, "term": term,
           "kind": source["kind"], "hit": False, "snippet": None, "error": None}
    try:
        if source["kind"] == "scamadviser":
            rec["url"] = f"https://www.scamadviser.com/check-website/{term}"
            parsed = parse_scamadviser(_fetch(rec["url"]), term)
            if parsed:
                rec.update(hit=True, grade="verdict", **parsed)
        elif source["kind"] == "site_search":
            query = f'site:{source["site"]} "{term}"'
            rec["url"] = f"https://www.google.com/search?q={quote_plus(query)}"
            parsed = parse_serp_community(_fetch_serp(query), term)
            if parsed:
                rec.update(hit=True, grade="mention", **parsed)
        elif source["kind"] == "web_reports":
            query = f'"{term}" (scam OR phishing OR fraud OR fake)'
            rec["url"] = f"https://www.google.com/search?q={quote_plus(query)}"
            found = parse_serp_reports(_fetch_serp(query), term)
            if found:
                rec.update(hit=True, grade="report",
                           snippet=f"Reported on {', '.join(h['source'] for h in found)}",
                           reported_on=[h["source"] for h in found])
        elif source["kind"] == "phish_feed":
            rec["url"] = "https://openphish.com/feed.txt"
            listed = match_phish_feed(term, _phish_feed_hosts())
            if listed:
                rec.update(hit=True, grade="feed", listed_as=listed,
                           snippet=f"Currently listed on the OpenPhish live "
                                   f"phishing feed as {listed}")
    except Exception as exc:
        rec["error"] = repr(exc)
        print(f"[reputation] {source['name']} failed: {exc!r}", file=sys.stderr)
    return rec


def reputation_scan(domain: str | None, phone: str | None) -> dict:
    """Fan out across every source for whichever of domain/phone we have."""
    empty = {"checked": [], "records": [], "hits": [],
             "checked_count": 0, "hit_count": 0, "error_count": 0}
    if not (os.environ.get("BRIGHT_DATA_API_KEY") and os.environ.get("BRIGHT_DATA_ZONE")):
        return empty  # not configured — handle once, don't fan out into N failures

    jobs = ([(s, domain, "domain") for s in DOMAIN_SOURCES] if domain else [])
    jobs += ([(s, phone, "phone") for s in PHONE_SOURCES] if phone else [])
    jobs = jobs[:MAX_FETCHES]
    if not jobs:
        return empty

    _stage(f"Bright Data: unlocking {len(jobs)} scam-report sources in parallel…")
    with ThreadPoolExecutor(max_workers=min(12, len(jobs))) as pool:
        records = list(pool.map(lambda j: _check(*j), jobs))

    hits = [r for r in records if r["hit"]]
    errors = [r for r in records if r["error"]]
    _stage(f"Bright Data: {len(records)} sources checked, {len(hits)} flagged this target")
    return {
        "checked": [f"{r['source']} ({r['target']})" for r in records],
        "records": records,
        "hits": hits,
        "checked_count": len(records),
        "hit_count": len(hits),
        "error_count": len(errors),
    }
