"""Twilio live-call intake → link agent. Reference glue for the JAGA spine.

Flow: customer three-way-merges our Twilio number into a suspicious call.
Twilio answers here (/voice), starts Real-Time Transcription, and POSTs each
utterance to /transcript. We extract URLs/phones the moment they're spoken,
kick off link-agent investigations in the background, and keep a live
per-call state that the app (or Yeehan's SSE layer) can read at /call/{sid}.

Run:
    uvicorn twilio_ingest:app --port 8035
    ngrok http 8035                       # then: python twilio_setup.py <ngrok url>

State is in-memory — hackathon glue, not a datastore.
"""
import json
import os
import threading
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response

from link_agent import extract_phones, extract_urls, investigate_link

load_dotenv(".env")

app = FastAPI(title="JAGA Twilio intake")

# Placeholder triage: phrase-spotting from the SG scam-call playbook.
# The real per-utterance classifier is the spine's job (TokenRouter/Kimi);
# this keeps the prototype demoable end-to-end without it.
SCAM_PHRASES = (
    "otp", "one-time password", "one time password", "safe account",
    "police", "warrant", "arrest", "money lock", "moneylock",
    "do not tell", "don't tell", "dont tell", "gift card", "bitcoin",
    "remote access", "anydesk", "teamviewer", "parcel held", "customs",
    "investigation", "transfer the money", "scam bureau",
)


def live_suspicion(transcript: str) -> tuple[str, list[str]]:
    """Cheap rolling read on the call so far: OK / CAUTION / DANGER."""
    text = (transcript or "").lower()
    hits = [p for p in SCAM_PHRASES if p in text]
    level = "DANGER" if len(hits) >= 2 else "CAUTION" if hits else "OK"
    return level, hits


def parse_transcription_event(form: dict) -> dict | None:
    """Twilio Real-Time Transcription status callback → one utterance, or None.

    Only "transcription-content" events carry text; everything else
    (started/stopped/error) is ignored. Malformed payloads are dropped,
    never raised — a webhook that 500s makes Twilio retry-storm us.
    """
    if form.get("TranscriptionEvent") != "transcription-content":
        return None
    try:
        data = json.loads(form.get("TranscriptionData") or "{}")
    except json.JSONDecodeError:
        return None
    text = (data.get("transcript") or "").strip()
    if not text:
        return None
    return {
        "call_sid": form.get("CallSid", ""),
        "text": text,
        "confidence": data.get("confidence"),
        "track": form.get("Track", ""),
        "final": (form.get("Final", "true") or "").lower() == "true",
    }


def _new_call_state() -> dict:
    return {"utterances": [], "suspicion": "OK", "phrase_hits": [],
            "artifacts": {"urls": [], "phones": []}, "findings": []}


CALLS: dict = defaultdict(_new_call_state)


def _investigate_async(call_sid: str, url: str | None, phone: str | None) -> None:
    def work():
        finding = investigate_link(url, phone)  # fail-soft by design
        CALLS[call_sid]["findings"].append(finding)
        print(f"[jaga] {call_sid} finding: risk={finding['risk']} {finding['findings']}")
    threading.Thread(target=work, daemon=True).start()


@app.post("/voice")
async def voice(request: Request) -> Response:
    """Answer the merged-in Twilio leg: transcribe, then sit silently in the call."""
    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    form = dict(await request.form())
    print(f"[jaga] call answered: {form.get('CallSid')} from {form.get('From')}")
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Transcription statusCallbackUrl="{base}/transcript" />
  </Start>
  <Pause length="3600"/>
</Response>"""
    return Response(content=twiml, media_type="text/xml")


@app.post("/transcript")
async def transcript(request: Request) -> Response:
    utt = parse_transcription_event(dict(await request.form()))
    if utt is None:
        return Response(status_code=204)

    state = CALLS[utt["call_sid"]]
    state["utterances"].append(utt)
    full_text = " ".join(u["text"] for u in state["utterances"])
    state["suspicion"], state["phrase_hits"] = live_suspicion(full_text)

    # Investigate each artifact once, the moment it first appears.
    for url in extract_urls(utt["text"]):
        if url not in state["artifacts"]["urls"]:
            state["artifacts"]["urls"].append(url)
            _investigate_async(utt["call_sid"], url, None)
    for phone in extract_phones(utt["text"]):
        if phone not in state["artifacts"]["phones"]:
            state["artifacts"]["phones"].append(phone)
            _investigate_async(utt["call_sid"], None, phone)

    print(f"[jaga] {utt['call_sid']} [{state['suspicion']}] {utt['text']}")
    return Response(status_code=204)


@app.get("/call/{call_sid}")
def call_state(call_sid: str) -> dict:
    """Live view for the app / spine: transcript so far, suspicion, findings."""
    return CALLS[call_sid]
