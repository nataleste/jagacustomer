"""Tests for the link-agent risk scorer.

Run: .venv/bin/python -m unittest test_link_agent -v
"""
import os
import unittest
from unittest import mock

from link_agent import (detect_brand_impersonation, extract_phones,
                        extract_urls, investigate_link, investigate_transcript,
                        registered_domain, score_risk)

CONTRACT_KEYS = {"agent", "risk", "findings", "evidence"}


def _no_keys_env():
    """Env with all JAGA/API keys stripped, so tests never make keyed calls."""
    return {k: v for k, v in os.environ.items()
            if not k.startswith(("DAYTONA", "BRIGHT_DATA", "JAGA",
                                 "TOKENROUTER", "TOKEN_ROUTER"))}


class TestScoreRisk(unittest.TestCase):
    def test_fake_bank_page_scores_high(self):
        risk, findings = score_risk({
            "brand_impersonation": "DBS",
            "domain_age_days": 3,
            "scam_report_hits": 2,
            "suspicious_redirects": True,
        })
        self.assertGreaterEqual(risk, 80)

    def test_real_bank_site_scores_low(self):
        # dbs.com.sg: aged domain, no impersonation (it IS the brand), no reports.
        # If this scores high, the weights are wrong — see handoff "Verify" section.
        risk, findings = score_risk({
            "brand_impersonation": None,
            "domain_age_days": 9000,
            "scam_report_hits": 0,
            "suspicious_redirects": False,
        })
        self.assertLess(risk, 25)


    def test_risk_caps_at_100(self):
        risk, _ = score_risk({
            "brand_impersonation": "DBS",
            "domain_age_days": 1,
            "scam_report_hits": 9,
            "suspicious_redirects": True,
        })
        self.assertEqual(risk, 100)

    def test_empty_signals_scores_zero_without_crashing(self):
        # All collectors failed (fail-soft) — must not crash, must not accuse.
        risk, findings = score_risk({})
        self.assertEqual(risk, 0)
        self.assertEqual(findings, [])

    def test_findings_are_plain_language(self):
        _, findings = score_risk({
            "brand_impersonation": "DBS",
            "domain_age_days": 3,
        })
        self.assertTrue(any("DBS" in f for f in findings))
        self.assertTrue(any("3 days" in f for f in findings))
        for f in findings:
            self.assertNotIn("http", f.lower())  # no URLs/jargon in findings


class TestTranscriptIngestion(unittest.TestCase):
    """Twilio hands the backend a text/call transcript; we take it from there."""

    SCAM_TRANSCRIPT = ("Hello, this is DBS security department. Your account is "
                       "frozen. Verify now at https://dbs-secure.vercel.app/ "
                       "or call us back at +65 9123 4567 immediately.")

    def test_extracts_urls_and_phones_from_transcript(self):
        self.assertEqual(extract_urls(self.SCAM_TRANSCRIPT),
                         ["https://dbs-secure.vercel.app/"])
        self.assertEqual(extract_phones(self.SCAM_TRANSCRIPT), ["+6591234567"])

    def test_extracts_bare_domain_without_trailing_punctuation(self):
        self.assertEqual(extract_urls("Go to dbs-verify.top now."),
                         ["https://dbs-verify.top"])

    def test_transcript_investigation_returns_contract_shape(self):
        with mock.patch.dict(os.environ, _no_keys_env(), clear=True):
            finding = investigate_transcript("You won a prize! Call 91234567 now")
        self.assertEqual(set(finding), CONTRACT_KEYS)
        self.assertEqual(finding["agent"], "link")
        self.assertEqual(finding["evidence"]["transcript_artifacts"]["phones"],
                         ["91234567"])

    def test_caller_phone_used_when_transcript_has_none(self):
        with mock.patch.dict(os.environ, _no_keys_env(), clear=True):
            finding = investigate_transcript("Your parcel is held at customs.",
                                             caller_phone="+6581234567")
        self.assertEqual(finding["evidence"]["transcript_artifacts"]["caller"],
                         "+6581234567")


class TestPhoneOnlyInvestigation(unittest.TestCase):
    """Live-call flow (Twilio ingestion): the worker gets a caller number
    from the transcript, often with no URL at all."""

    def test_phone_only_returns_contract_shape_and_skips_detonation(self):
        with mock.patch.dict(os.environ, _no_keys_env(), clear=True):
            finding = investigate_link(None, "+6591234567")
        self.assertEqual(set(finding), CONTRACT_KEYS)
        self.assertEqual(finding["agent"], "link")
        # No URL → detonation is skipped, not "failed": no scary browser note.
        self.assertFalse(any("browser" in f for f in finding["findings"]))

    def test_nothing_to_check_returns_calm_zero_finding(self):
        with mock.patch.dict(os.environ, _no_keys_env(), clear=True):
            finding = investigate_link(None, None)
        self.assertEqual(finding["risk"], 0)
        self.assertEqual(set(finding), CONTRACT_KEYS)


class TestFreeHostingSignal(unittest.TestCase):
    def test_free_host_subdomain_adds_risk_with_plain_finding(self):
        risk, findings = score_risk({"free_hosting": True})
        self.assertGreater(risk, 0)
        self.assertTrue(any("free" in f.lower() for f in findings))

    def test_fake_page_on_free_host_scores_high_without_age_signal(self):
        # vercel.app inherits the platform's 30-year age — age must not be
        # the thing that saves a fake bank page hosted there.
        risk, _ = score_risk({"brand_impersonation": "DBS", "free_hosting": True,
                              "domain_age_days": None})
        self.assertGreaterEqual(risk, 75)

    def test_brand_login_on_free_host_combo_is_near_certain(self):
        # The demo number: a brand credential form on free hosting never
        # happens innocently — floor the score at 96.
        risk, findings = score_risk({"brand_impersonation": "DBS", "free_hosting": True})
        self.assertEqual(risk, 96)
        self.assertTrue(any("real bank" in f.lower() for f in findings))

    def test_combo_with_scam_reports_still_caps_at_100(self):
        risk, _ = score_risk({"brand_impersonation": "DBS", "free_hosting": True,
                              "scam_report_hits": 3})
        self.assertEqual(risk, 100)


FAKE_DBS_HTML = """<html><head><title>DBS Secure Verify</title></head><body>
<div class="banner">Your account will be suspended in 24 hours</div>
<form><input name="user"><input type="password" name="pin"></form></body></html>"""


class TestRegisteredDomain(unittest.TestCase):
    def test_handles_sg_two_part_suffix(self):
        self.assertEqual(registered_domain("www.dbs.com.sg"), "dbs.com.sg")

    def test_handles_plain_tld_with_subdomain(self):
        self.assertEqual(registered_domain("dbs-secure.vercel.app"), "vercel.app")


class TestBrandImpersonation(unittest.TestCase):
    def test_fake_dbs_login_on_foreign_domain_is_flagged(self):
        brand = detect_brand_impersonation(
            FAKE_DBS_HTML, "DBS Secure Verify", "https://dbs-secure.vercel.app/")
        self.assertEqual(brand, "DBS")

    def test_real_dbs_site_is_not_flagged(self):
        # The genuine site renders a genuine DBS login — must NOT count as impersonation.
        brand = detect_brand_impersonation(
            FAKE_DBS_HTML, "DBS digibank Login", "https://www.dbs.com.sg/personal/login")
        self.assertIsNone(brand)

    def test_brand_mention_without_credential_form_is_not_flagged(self):
        html = "<html><title>News about DBS</title><body>DBS announced earnings</body></html>"
        brand = detect_brand_impersonation(html, "News about DBS", "https://news.example.com/")
        self.assertIsNone(brand)


if __name__ == "__main__":
    unittest.main()
