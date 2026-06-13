"""One-shot Twilio setup check + webhook wiring.

    python twilio_setup.py                      # verify account + number, report trial status
    python twilio_setup.py https://x.ngrok.app  # also point the number's voice webhook there

Needs in .env: TWILIO_ACCOUNT_SID, TWILIO_API_KEY (auth token), TWILIO_PHONE_NUMBER.
Secrets are read from the environment and never printed.
"""
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv(".env")

API = "https://api.twilio.com/2010-04-01"


def main() -> int:
    try:
        sid = os.environ["TWILIO_ACCOUNT_SID"]
        token = os.environ["TWILIO_API_KEY"]
        number = os.environ["TWILIO_PHONE_NUMBER"]
    except KeyError as missing:
        print(f"Missing {missing} in .env — add it (see README).", file=sys.stderr)
        return 1
    auth = (sid, token)

    acct = requests.get(f"{API}/Accounts/{sid}.json", auth=auth, timeout=30)
    if acct.status_code != 200:
        print(f"Auth failed ({acct.status_code}). Check TWILIO_ACCOUNT_SID + token pair.",
              file=sys.stderr)
        return 1
    acct_type = acct.json().get("type")
    print(f"Account OK — status: {acct.json().get('status')}, type: {acct_type}")
    if acct_type == "Trial":
        print("⚠ TRIAL account: a robot trial message plays into every call and "
              "calls cap at 10 minutes. Upgrade before the demo.")

    nums = requests.get(f"{API}/Accounts/{sid}/IncomingPhoneNumbers.json",
                        params={"PhoneNumber": number}, auth=auth, timeout=30).json()
    matches = nums.get("incoming_phone_numbers", [])
    if not matches:
        print(f"Number {number} not found on this account.", file=sys.stderr)
        return 1
    num = matches[0]
    print(f"Number OK — {num['phone_number']}, voice webhook: {num.get('voice_url') or '(none)'}")

    if len(sys.argv) > 1:
        base = sys.argv[1].rstrip("/")
        upd = requests.post(f"{API}/Accounts/{sid}/IncomingPhoneNumbers/{num['sid']}.json",
                            data={"VoiceUrl": f"{base}/voice", "VoiceMethod": "POST"},
                            auth=auth, timeout=30)
        upd.raise_for_status()
        print(f"Voice webhook now → {upd.json()['voice_url']}")
        print("Remember: PUBLIC_BASE_URL must be set in .env for the transcription callback.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
