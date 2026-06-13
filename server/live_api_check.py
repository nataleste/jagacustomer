"""Live smoke test for the two paid APIs — Daytona + Bright Data.

Isolates each API so we know exactly which one works. Prints PASS/FAIL and
timings only; never prints a key value. Run: .venv/bin/python live_api_check.py
"""
import os
import sys
import time
import traceback

from dotenv import load_dotenv

load_dotenv()


def tag(ok: bool) -> str:
    return "PASS ✓" if ok else "FAIL ✗"


results = {}

# ----------------------------------------------------------- Bright Data ----
print("== Bright Data ==", flush=True)
try:
    from reputation import _fetch, _fetch_serp

    t = time.time()
    body = _fetch("https://example.com")            # Web Unlocker path
    unlock_ok = "Example Domain" in body
    print(f"  unlocker  _fetch(example.com): {len(body)} bytes / {time.time()-t:.1f}s  {tag(unlock_ok)}", flush=True)

    t = time.time()
    organic = _fetch_serp("singapore bank phishing scam")  # SERP path (brd_json=1)
    serp_ok = len(organic) > 0
    sample = (organic[0].get("link") if organic else "")[:60]
    print(f"  serp      _fetch_serp(...): {len(organic)} organic / {time.time()-t:.1f}s  {tag(serp_ok)}", flush=True)
    if sample:
        print(f"            first result: {sample}", flush=True)

    results["brightdata_unlocker"] = unlock_ok
    results["brightdata_serp"] = serp_ok
except Exception:
    traceback.print_exc()
    results["brightdata_unlocker"] = False
    results["brightdata_serp"] = False

# -------------------------------------------------------------- Daytona ----
print("\n== Daytona ==", flush=True)
try:
    from daytona import Daytona

    t = time.time()
    d = Daytona()                                   # reads DAYTONA_API_KEY
    sb = d.create()
    print(f"  sandbox created / {time.time()-t:.1f}s", flush=True)
    try:
        run = sb.process.exec("echo JAGA_OK", timeout=60)
        out = (getattr(run, "result", "") or "")
        exec_ok = "JAGA_OK" in out
        print(f"  exec echo -> {out.strip()[:40]!r}  {tag(exec_ok)}", flush=True)
        results["daytona"] = exec_ok
    finally:
        d.delete(sb)
        print("  sandbox deleted (nothing persists)", flush=True)
except Exception:
    traceback.print_exc()
    results["daytona"] = False

# -------------------------------------------------------------- summary ----
print("\n== SUMMARY ==", flush=True)
for k, v in results.items():
    print(f"  {k:24s} {tag(v)}", flush=True)
sys.exit(0 if results and all(results.values()) else 1)
