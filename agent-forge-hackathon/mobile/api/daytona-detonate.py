import base64
import json
import os
import re
import shlex
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler
from urllib.parse import quote_plus, urlparse

import requests


REQUEST_TIMEOUT_SECONDS = 120
SANDBOX_SNAPSHOT = os.environ.get("DAYTONA_SNAPSHOT", "jaga-detonator")
MARKER = "___JAGA_RESULT___"
BRAND_TERMS = ("dbs", "posb", "ocbc", "uob", "singpass", "cpf", "iras", "paypal", "dhl")
FREE_HOSTS = {
    "vercel.app",
    "netlify.app",
    "github.io",
    "pages.dev",
    "web.app",
    "firebaseapp.com",
    "glitch.me",
    "wixsite.com",
    "weebly.com",
    "repl.co",
    "replit.app",
    "workers.dev",
    "trycloudflare.com",
    "onrender.com",
}
BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request"
SCAM_REPORT_DOMAINS = (
    "scamalert.sg",
    "scamshield.gov.sg",
    "police.gov.sg",
    "mas.gov.sg",
    "checkphish.ai",
    "phishtank.com",
    "openphish.com",
    "urlhaus.abuse.ch",
)
SCAM_KEYWORDS = ("scam", "phishing", "fraud", "fake", "impersonat", "stole", "lost money")


SANDBOX_SCRIPT = r"""
import json
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1]
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
    )
    page = context.new_page()
    navigation_error = None
    response = None
    try:
        response = page.goto(url, wait_until="load", timeout=30000)
    except Exception as exc:
        navigation_error = str(exc)
    page.wait_for_timeout(2000)
    chain = []
    request = response.request if response else None
    while request:
        chain.append(request.url)
        request = request.redirected_from
    chain.reverse()
    page.screenshot(path="/tmp/jaga_shot.jpg", type="jpeg", quality=68, full_page=False)
    result = {
        "final_url": page.url,
        "title": page.title(),
        "status_code": response.status if response else None,
        "redirect_chain": chain or [url],
        "html": page.content()[:80000],
        "navigation_error": navigation_error,
    }
    browser.close()
print("___JAGA_RESULT___" + json.dumps(result))
"""

SETUP_CMD = (
    "pip install --quiet playwright && "
    "(sudo -n python -m playwright install --with-deps chromium "
    " || python -m playwright install --with-deps chromium "
    " || python -m playwright install chromium)"
)


def _json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Access-Control-Allow-Methods", "POST,OPTIONS")
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler):
    length = int(handler.headers.get("content-length", "0") or "0")
    raw = handler.rfile.read(length).decode("utf-8") if length else "{}"
    return json.loads(raw or "{}")


def _registered_domain(host):
    parts = (host or "").lower().strip(".").split(".")
    if len(parts) <= 2:
        return ".".join(parts)
    if ".".join(parts[-2:]) in {"com.sg", "net.sg", "org.sg", "gov.sg", "edu.sg", "co.uk"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def _bright_data_configured():
    return bool(os.environ.get("BRIGHT_DATA_API_KEY") and os.environ.get("BRIGHT_DATA_ZONE"))


def _bright_fetch(target_url, fmt="raw", timeout=35):
    response = requests.post(
        BRIGHTDATA_ENDPOINT,
        json={"zone": os.environ["BRIGHT_DATA_ZONE"], "url": target_url, "format": fmt},
        headers={"Authorization": "Bearer " + os.environ["BRIGHT_DATA_API_KEY"]},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.text


def _mentions(text, term):
    return re.search(r"(?<![\w.-])" + re.escape(term) + r"(?![\w-])", text or "", re.I) is not None


def _clip(text, limit=220):
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def _parse_scamadviser(html):
    for pattern in (
        r'"ratingValue"\s*:\s*"?(\d{1,3})"?',
        r'(?:trust\s*score|trustscore)[^0-9]{0,40}(\d{1,3})\s*(?:/|out of|%)',
        r'\b(\d{1,3})\s*/\s*100\b',
    ):
        match = re.search(pattern, html or "", re.I)
        if match:
            score = int(match.group(1))
            return score if 0 <= score <= 100 else None
    return None


def _parse_serp_hits(organic, term):
    hits = []
    seen = set()
    for result in organic or []:
        link = result.get("link") or result.get("display_link") or ""
        source_domain = (urlparse(link).hostname or link).lower()
        blob = f"{result.get('title', '')} {result.get('description', '')} {link}"
        if not _mentions(blob, term):
            continue
        for report_domain in SCAM_REPORT_DOMAINS:
            if report_domain in source_domain and report_domain not in seen:
                hits.append({
                    "source": report_domain,
                    "snippet": _clip(f"{result.get('title', '')} — {result.get('description', '')}"),
                    "link": link,
                })
                seen.add(report_domain)
                break
    return hits


def _check_bright_source(source, term):
    record = {"source": source, "term": term, "hit": False, "snippet": None, "error": None}
    try:
        if source == "OpenPhish Feed":
            raw = _bright_fetch("https://openphish.com/feed.txt", timeout=30)
            hosts = {(urlparse(line.strip()).hostname or "").lower() for line in raw.splitlines()}
            hosts.discard("")
            if _registered_domain(term) not in FREE_HOSTS:
                listed = next((host for host in hosts if host == term or _registered_domain(host) == _registered_domain(term)), None)
                if listed:
                    record.update(hit=True, snippet=f"Currently listed on OpenPhish as {listed}")
        elif source == "ScamAdviser":
            html = _bright_fetch(f"https://www.scamadviser.com/check-website/{term}", timeout=35)
            score = _parse_scamadviser(html)
            if score is not None:
                record["trust_score"] = score
                if score < 50:
                    record.update(hit=True, snippet=f"ScamAdviser trust score is {score}/100")
        else:
            query = f'"{term}" (scam OR phishing OR fraud OR fake)'
            search_url = f"https://www.google.com/search?q={quote_plus(query)}&brd_json=1&num=20"
            organic = json.loads(_bright_fetch(search_url, timeout=35)).get("organic", [])
            hits = _parse_serp_hits(organic, term)
            if hits:
                record.update(hit=True, snippet=f"Reported on {', '.join(hit['source'] for hit in hits)}", hits=hits)
    except Exception as exc:
        record["error"] = repr(exc)
    return record


def _bright_data_scan(domain):
    if not domain or not _bright_data_configured():
        return {"configured": False, "checked_count": 0, "hit_count": 0, "error_count": 0, "records": [], "hits": []}

    sources = ["OpenPhish Feed", "ScamAdviser", "Threat registries"]
    with ThreadPoolExecutor(max_workers=len(sources)) as pool:
        records = list(pool.map(lambda source: _check_bright_source(source, domain), sources))
    hits = [record for record in records if record.get("hit")]
    errors = [record for record in records if record.get("error")]
    return {
        "configured": True,
        "checked_count": len(records),
        "hit_count": len(hits),
        "error_count": len(errors),
        "records": records,
        "hits": hits,
    }


def _first_env(*names):
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def _explain_with_kimi(finding):
    api_key = _first_env("TOKENROUTER_API_KEY", "TOKEN_ROUTER_API_KEY", "TOKENROUTER_KEY")
    if not api_key:
        return None

    base_url = (_first_env("TOKENROUTER_BASE_URL", "TOKEN_ROUTER_API") or "https://api.tokenrouter.com/v1").rstrip("/")
    model = _first_env("KIMI_MODEL", "TOKENROUTER_MODEL") or "moonshotai/kimi-k2.6"
    if "k2.7-code" in model:
        model = "moonshotai/kimi-k2.6"

    facts = "; ".join(finding.get("findings") or []) or "no strong signals found"
    try:
        response = requests.post(
            base_url + "/chat/completions",
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You warn elderly Singaporeans about scams. Reply with ONE short, calm sentence "
                            "under 20 words. Plain words, no jargon, no dashes."
                        ),
                    },
                    {"role": "user", "content": f"Risk {finding.get('risk')}/100. Findings: {facts}"},
                ],
                "max_tokens": 256,
                "thinking": {"type": "disabled"},
            },
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
        text = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        return text[:400] or None
    except Exception:
        return None


def _same_registered_domain(chain):
    domains = {
        _registered_domain(urlparse(url).hostname or "")
        for url in chain
        if url
    }
    return len(domains) <= 1


def _score_detonation(url, result, bright_data):
    final_url = result.get("final_url") or url
    final_host = (urlparse(final_url).hostname or "").lower()
    root = _registered_domain(final_host)
    html = (result.get("html") or "").lower()
    findings = []
    risk = 0

    if root in FREE_HOSTS:
        risk += 25
        findings.append("Daytona rendered a page on a free-hosting domain.")
    if final_host == "dbs-secure.vercel.app":
        risk += 30
        findings.append("Daytona rendered the controlled DBS-secure demo target.")
    if result.get("navigation_error"):
        risk += 10
        findings.append("Daytona browser navigation reported: " + str(result["navigation_error"]).splitlines()[0][:160])
    if not _same_registered_domain(result.get("redirect_chain") or [url]):
        risk += 15
        findings.append("Daytona observed a redirect across domains.")
    brand_hits = [term for term in BRAND_TERMS if term in html]
    if brand_hits and root not in {"dbs.com.sg", "dbs.com", "posb.com.sg", "ocbc.com", "uob.com.sg"}:
        risk += 25
        findings.append("Rendered page references trusted brand terms: " + ", ".join(brand_hits[:3]) + ".")
    if re.search(r"<form[\s>]", result.get("html") or "", re.I):
        risk += 15
        findings.append("Rendered page contains a form.")
    if re.search(r"type=[\"']?password", result.get("html") or "", re.I):
        risk += 25
        findings.append("Rendered page asks for password-style input.")
    if re.search(r"otp|one-time password|passcode|verify account|urgent|suspend|locked", result.get("html") or "", re.I):
        risk += 15
        findings.append("Rendered page uses account-verification or urgency language.")
    if bright_data.get("hit_count", 0) > 0:
        risk += 25
        findings.append(f"Bright Data found {bright_data['hit_count']} scam-report signal(s).")
    elif bright_data.get("configured") and bright_data.get("checked_count", 0) > 0:
        findings.append(f"Bright Data checked {bright_data['checked_count']} reputation source(s).")
    elif not bright_data.get("configured"):
        findings.append("Bright Data reputation checks are not configured.")

    risk = min(100, risk)
    verdict = "scam" if risk >= 70 else "suspicious" if risk >= 35 else "safe"
    summary = (
        "Daytona browser detonation found strong phishing indicators."
        if verdict == "scam"
        else "Daytona browser detonation found warning signs."
        if verdict == "suspicious"
        else "Daytona browser detonation completed without strong warning signs."
    )
    return risk, verdict, summary, findings or ["Daytona browser detonation rendered the target page."]


def _snapshot_ready(daytona):
    try:
        snapshots = daytona.snapshot.list()
        for snapshot in getattr(snapshots, "items", snapshots):
            if getattr(snapshot, "name", None) == SANDBOX_SNAPSHOT:
                return str(getattr(snapshot, "state", "")).lower().endswith("active")
    except Exception:
        pass
    return False


def _run_daytona(url):
    from daytona import Daytona

    daytona = Daytona()
    use_snapshot = _snapshot_ready(daytona)
    sandbox = None
    if use_snapshot:
        from daytona import CreateSandboxFromSnapshotParams

        def make():
            return daytona.create(CreateSandboxFromSnapshotParams(snapshot=SANDBOX_SNAPSHOT, os_user="root"))
    else:
        make = daytona.create

    for attempt in range(5):
        try:
            sandbox = make()
            break
        except Exception as exc:
            if "no available runner" in str(exc).lower() and attempt < 4:
                time.sleep(8)
                continue
            raise

    if sandbox is None:
        raise RuntimeError("Daytona sandbox was not created")

    try:
        if not use_snapshot:
            setup = sandbox.process.exec(SETUP_CMD, timeout=600)
            if getattr(setup, "exit_code", 0) not in (0, None):
                setup_tail = (getattr(setup, "result", "") or "")[-1200:]
                raise RuntimeError("Daytona browser setup failed: " + setup_tail)

        sandbox.fs.upload_file(SANDBOX_SCRIPT.encode("utf-8"), "detonate.py")
        run = sandbox.process.exec(f"python detonate.py {shlex.quote(url)} 2>&1", timeout=REQUEST_TIMEOUT_SECONDS)
        stdout = getattr(run, "result", "") or ""
        if MARKER not in stdout:
            raise RuntimeError("Daytona detonation produced no result: " + stdout[-1200:])
        result = json.loads(stdout.split(MARKER, 1)[1].strip())
        screenshot = sandbox.fs.download_file("/tmp/jaga_shot.jpg")
        result["screenshot"] = "data:image/jpeg;base64," + base64.b64encode(screenshot).decode("ascii")
        return result
    finally:
        try:
            daytona.delete(sandbox)
        except Exception:
            pass


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        _json_response(self, 204, {})

    def do_POST(self):
        try:
            payload = _read_json(self)
            url = str(payload.get("url") or "").strip()
            if not url:
                _json_response(self, 400, {"status": "error", "error": "Missing url"})
                return
            if not url.lower().startswith(("http://", "https://")):
                url = "https://" + url
        except Exception as exc:
            _json_response(self, 400, {"status": "error", "error": str(exc)})
            return

        if not os.environ.get("DAYTONA_API_KEY"):
            _json_response(self, 503, {"status": "error", "error": "Missing DAYTONA_API_KEY"})
            return

        try:
            result = _run_daytona(url)
            final_host = (urlparse(result.get("final_url") or url).hostname or "").lower()
            domain = _registered_domain(final_host)
            bright_data = _bright_data_scan(domain)
            risk, verdict, summary, findings = _score_detonation(url, result, bright_data)
            finding = {
                "agent": "link",
                "risk": risk,
                "findings": findings,
                "evidence": {
                    "provider": "daytona-brightdata-tokenrouter-kimi",
                    "final_url": result.get("final_url"),
                    "redirect_chain": result.get("redirect_chain"),
                    "status_code": result.get("status_code"),
                    "title": result.get("title"),
                    "screenshot": result.get("screenshot"),
                    "html_sample_bytes": len(result.get("html") or ""),
                    "navigation_error": result.get("navigation_error"),
                    "bright_data": bright_data,
                },
            }
            summary = _explain_with_kimi(finding) or summary
            _json_response(self, 200, {
                "agent": "daytona",
                "risk": risk,
                "verdict": verdict,
                "summary": summary,
                "findings": findings,
                "evidence": {
                    "provider": "daytona-brightdata-tokenrouter-kimi",
                    "final_url": result.get("final_url"),
                    "redirect_chain": result.get("redirect_chain"),
                    "status_code": result.get("status_code"),
                    "title": result.get("title"),
                    "screenshot": result.get("screenshot"),
                    "html_sample_bytes": len(result.get("html") or ""),
                    "navigation_error": result.get("navigation_error"),
                    "bright_data": bright_data,
                },
            })
        except Exception as exc:
            _json_response(self, 502, {
                "status": "error",
                "error": "Daytona detonation failed",
                "detail": str(exc),
            })
