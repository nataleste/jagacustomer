"""Tests for the Twilio transcript intake glue.

Run: .venv/bin/python -m unittest test_twilio_ingest -v
"""
import json
import unittest

from twilio_ingest import live_suspicion, parse_transcription_event


class TestParseTranscriptionEvent(unittest.TestCase):
    def test_content_event_yields_utterance(self):
        form = {
            "TranscriptionEvent": "transcription-content",
            "CallSid": "CA123",
            "Track": "inbound_track",
            "Final": "true",
            "TranscriptionData": json.dumps(
                {"transcript": "Please verify at dbs-secure.vercel.app",
                 "confidence": 0.91}),
        }
        utt = parse_transcription_event(form)
        self.assertEqual(utt["call_sid"], "CA123")
        self.assertIn("dbs-secure", utt["text"])
        self.assertTrue(utt["final"])

    def test_non_content_events_are_ignored(self):
        self.assertIsNone(parse_transcription_event(
            {"TranscriptionEvent": "transcription-started", "CallSid": "CA123"}))

    def test_malformed_payload_is_ignored_not_crashed(self):
        self.assertIsNone(parse_transcription_event(
            {"TranscriptionEvent": "transcription-content",
             "TranscriptionData": "{not json"}))


class TestLiveSuspicion(unittest.TestCase):
    def test_scam_script_phrases_escalate_to_danger(self):
        level, hits = live_suspicion(
            "this is the police, your account is involved. read me the OTP "
            "and do not tell your family")
        self.assertEqual(level, "DANGER")
        self.assertGreaterEqual(len(hits), 2)

    def test_benign_call_stays_ok(self):
        level, hits = live_suspicion("hi ma, dinner at seven tonight? bring the dog")
        self.assertEqual(level, "OK")
        self.assertEqual(hits, [])


if __name__ == "__main__":
    unittest.main()
