"""Tiny HTTP wrapper around the JAGA link agent so the web app can call it.

The front-end (jaga-app) POSTs a pasted link/message here and renders the
finding. Same four-key contract the rest of the team uses, plus the optional
Kimi `summary`.

Run — mock (no keys, instant canned finding):
    JAGA_MOCK=1 uvicorn api:app --port 8000

Run — real (Daytona + Bright Data + TokenRouter, with .env filled):
    uvicorn api:app --port 8000
"""
import os
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from link_agent import investigate_link

app = FastAPI(title="JAGA Link API")

# Allow the Vite dev server (and anything else) to call this in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the Daytona detonation screenshots so the web app can show the real
# capture (e.g. evidence/detonation_123.png -> /api/evidence/detonation_123.png).
EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)
app.mount("/api/evidence", StaticFiles(directory=EVIDENCE_DIR), name="evidence")


class CheckRequest(BaseModel):
    url: Optional[str] = None
    phone: Optional[str] = None


@app.get("/api/health")
def health():
    return {"ok": True, "mock": os.environ.get("JAGA_MOCK") == "1"}


@app.post("/api/investigate-link")
def investigate(req: CheckRequest):
    """Returns { agent, risk, findings[], evidence{}, summary? }.

    The detonation screenshot path is rewritten to a servable URL (or None
    if the file isn't present, e.g. in mock mode) so the web app can <img> it.
    """
    finding = investigate_link(req.url, req.phone)
    evidence = finding.get("evidence") or {}
    shot = evidence.get("screenshot")
    if shot:
        name = os.path.basename(shot)
        evidence["screenshot"] = (
            f"/api/evidence/{name}" if os.path.exists(os.path.join(EVIDENCE_DIR, name)) else None
        )
    return finding
