"""Detonate a suspicious URL inside a Daytona sandbox.

The untrusted URL is NEVER loaded in this process — only inside the
sandbox, by headless Playwright. That isolation is the entire point.

Returns: { screenshot, final_url, redirect_chain, title, html }
"""
import json
import os
import shlex
import sys
import time


def _stage(msg: str) -> None:
    """Live progress narration (stderr keeps stdout JSON clean for piping)."""
    print(f"  → {msg}", file=sys.stderr, flush=True)

EVIDENCE_DIR = "evidence"
MARKER = "___JAGA_RESULT___"

# Runs INSIDE the sandbox, never locally.
SANDBOX_SCRIPT = """
import json, sys
from playwright.sync_api import sync_playwright

url = sys.argv[1]
with sync_playwright() as p:
    browser = p.chromium.launch()
    # Mainstream UA: the default "HeadlessChrome" token gets connections
    # reset by some sites. This is standard hygiene, not bot-defense evasion —
    # targets that still refuse us simply yield no detonation evidence.
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
    )
    page = context.new_page()
    response = page.goto(url, wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)  # let banners/JS settle for the screenshot
    chain = []
    request = response.request if response else None
    while request:
        chain.append(request.url)
        request = request.redirected_from
    chain.reverse()
    page.screenshot(path="/tmp/jaga_shot.png", full_page=True)
    result = {
        "final_url": page.url,
        "title": page.title(),
        "redirect_chain": chain or [url],
        "html": page.content()[:200000],
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


SNAPSHOT_NAME = os.environ.get("DAYTONA_SNAPSHOT", "jaga-detonator")


def _snapshot_ready(daytona) -> bool:
    """Is the pre-baked Chromium snapshot active? Cheap check, fails to False."""
    try:
        res = daytona.snapshot.list()
        for s in getattr(res, "items", res):
            if getattr(s, "name", None) == SNAPSHOT_NAME:
                return str(getattr(s, "state", "")).lower().endswith("active")
    except Exception:
        pass
    return False


def detonate(url: str) -> dict:
    """Create sandbox -> (install chromium if needed) -> load URL -> evidence -> destroy.

    Prefers the pre-baked '%s' snapshot (Chromium already installed, ~5-10s). Falls
    back to a blank sandbox + on-the-fly install (~45s) so it works before the
    snapshot is built. Runs as root so the baked-in browser cache is found.
    """ % SNAPSHOT_NAME
    from daytona import Daytona  # lazy: module stays importable without the SDK

    daytona = Daytona()  # reads DAYTONA_API_KEY from the environment
    use_snapshot = _snapshot_ready(daytona)
    if use_snapshot:
        from daytona import CreateSandboxFromSnapshotParams
        _stage(f"Booting sandbox from snapshot '{SNAPSHOT_NAME}' (Chromium pre-installed)")
        make = lambda: daytona.create(
            CreateSandboxFromSnapshotParams(snapshot=SNAPSHOT_NAME, os_user="root"))
    else:
        _stage("Creating isolated sandbox (Daytona) — the link never touches this machine")
        make = daytona.create
    # Daytona capacity can transiently report "No available runners" — retry a few times.
    sandbox = None
    for attempt in range(5):
        try:
            sandbox = make()
            break
        except Exception as exc:
            if "no available runner" in str(exc).lower() and attempt < 4:
                _stage(f"No free runner yet — retrying ({attempt + 1}/5)")
                time.sleep(8)
                continue
            raise
    try:
        if not use_snapshot:
            _stage("Installing headless browser inside the sandbox (~45s)")
            setup = sandbox.process.exec(SETUP_CMD, timeout=600)
            if getattr(setup, "exit_code", 0) not in (0, None):
                raise RuntimeError(f"sandbox setup failed: {getattr(setup, 'result', '')[-500:]}")

        _stage("Detonating the link inside the sandbox")
        sandbox.fs.upload_file(SANDBOX_SCRIPT.encode(), "detonate.py")
        run = sandbox.process.exec(f"python detonate.py {shlex.quote(url)} 2>&1", timeout=120)
        stdout = getattr(run, "result", "") or ""
        if MARKER not in stdout:
            raise RuntimeError(f"detonation produced no result: {stdout[-500:]}")
        result = json.loads(stdout.split(MARKER, 1)[1].strip())

        _stage("Capturing screenshot and redirect evidence")
        os.makedirs(EVIDENCE_DIR, exist_ok=True)
        shot_path = os.path.join(EVIDENCE_DIR, f"detonation_{int(time.time())}.png")
        with open(shot_path, "wb") as f:
            f.write(sandbox.fs.download_file("/tmp/jaga_shot.png"))
        result["screenshot"] = shot_path
        return result
    finally:
        _stage("Destroying the sandbox — nothing persists")
        try:
            daytona.delete(sandbox)
        except Exception:
            pass  # never let cleanup mask the real error


if __name__ == "__main__":
    import sys
    print(json.dumps(detonate(sys.argv[1]), indent=2, default=str)[:2000])
