"""Tests for the Bright Data reputation parsers (no network, pure logic).

The SERP parsers take Bright Data's structured `organic` results (a list of
{title, link, description}), so the tests are clean dicts, not HTML soup.

Run: .venv/bin/python -m unittest test_reputation -v
"""
import unittest

from reputation import (TRUST_THRESHOLD, match_phish_feed, parse_scamadviser,
                        parse_serp_community, parse_serp_reports)


class TestScamAdviserParser(unittest.TestCase):
    def test_low_trust_score_json_is_a_hit(self):
        html = '<script type="application/ld+json">{"@type":"Rating","ratingValue":"12","bestRating":"100"}</script>'
        hit = parse_scamadviser(html, "dbs-secure-verify.top")
        self.assertIsNotNone(hit)
        self.assertEqual(hit["trust_score"], 12)

    def test_high_trust_score_is_not_a_hit(self):
        # The genuine bank scores high on ScamAdviser — must never flag.
        html = '<script>{"@type":"Rating","ratingValue":"91","bestRating":"100"}</script>'
        self.assertIsNone(parse_scamadviser(html, "dbs.com.sg"))

    def test_textual_trust_score_form_is_parsed(self):
        html = "The trust score of evil-bank.top is 8 out of 100. Very low."
        self.assertEqual(parse_scamadviser(html, "evil-bank.top")["trust_score"], 8)

    def test_threshold_boundary(self):
        self.assertIsNone(parse_scamadviser(f'{{"ratingValue":"{TRUST_THRESHOLD}"}}', "x.com"))
        self.assertIsNotNone(parse_scamadviser(f'{{"ratingValue":"{TRUST_THRESHOLD - 1}"}}', "x.com"))


class TestSerpCommunityParser(unittest.TestCase):
    def test_result_naming_term_with_scam_word_is_a_hit(self):
        organic = [{"title": "dbs-verify.top — phishing scam alert",
                    "description": "Members report losing money to this fake site.",
                    "link": "https://scamalert.sg/x"}]
        hit = parse_serp_community(organic, "dbs-verify.top")
        self.assertIsNotNone(hit)
        self.assertIn("scam", hit["snippet"].lower())

    def test_neutral_result_about_real_brand_is_not_a_hit(self):
        # A genuine forum thread mentioning dbs.com.sg with no scam framing.
        organic = [{"title": "DBS digibank tips",
                    "description": "How to use dbs.com.sg for PayNow transfers.",
                    "link": "https://forums.hardwarezone.com.sg/threads/1"}]
        self.assertIsNone(parse_serp_community(organic, "dbs.com.sg"))

    def test_no_results_is_not_a_hit(self):
        self.assertIsNone(parse_serp_community([], "anything.top"))


class TestSerpReportsParser(unittest.TestCase):
    def test_result_from_scam_report_domain_naming_term_counts(self):
        organic = [{"title": "evil.top reported", "description": "Scam alert: evil.top",
                    "link": "https://www.scamalert.sg/report/evil.top"}]
        hits = parse_serp_reports(organic, "evil.top")
        self.assertEqual([h["source"] for h in hits], ["scamalert.sg"])

    def test_auto_review_aggregator_is_not_a_report_domain(self):
        # Scam Detector / ScamAdviser mint a page for EVERY domain — presence
        # there is not a listing, so they are excluded from REPORT_DOMAINS.
        organic = [{"title": "wikipedia.org Reviews: Is this site a scam or legit?",
                    "description": "wikipedia.org review", "link": "https://www.scam-detector.com/validator/wikipedia-org/"}]
        self.assertEqual(parse_serp_reports(organic, "wikipedia.org"), [])

    def test_term_not_matched_as_substring_of_longer_domain(self):
        organic = [{"title": "resume-example.com listed", "description": "scam",
                    "link": "https://scamalert.sg/x"}]
        self.assertEqual(parse_serp_reports(organic, "example.com"), [])

    def test_targets_own_brand_page_does_not_count(self):
        # The decisive case: searching "dbs.com.sg scam" surfaces DBS's OWN
        # anti-scam page. It names the term and the word scam — but it is the
        # brand's page, not a report against it. Source domain isn't a
        # report site, so it must NOT count.
        organic = [{"title": "Latest scams & frauds",
                    "description": "When in doubt contact DBS. dbs.com.sg",
                    "link": "https://www.dbs.com.sg/personal/protecting-yourself-online"}]
        self.assertEqual(parse_serp_reports(organic, "dbs.com.sg"), [])

    def test_report_site_result_not_about_our_term_does_not_count(self):
        organic = [{"title": "Some other scam", "description": "unrelated",
                    "link": "https://scamalert.sg/other"}]
        self.assertEqual(parse_serp_reports(organic, "evil.top"), [])


class TestPhishFeedMatcher(unittest.TestCase):
    """The decisive leg: direct membership in the live OpenPhish feed."""

    FEED = {
        "staging.citiretailservices.citibankonlline.com",
        "ocbc-secure-login.xyz",
        "instagram-clone-login.vercel.app",  # a sibling on shared hosting
    }

    def test_listed_subhost_flags_the_registrable_domain(self):
        # Target is the registrable domain; feed lists a sub-host of it.
        self.assertEqual(match_phish_feed("citibankonlline.com", self.FEED),
                         "staging.citiretailservices.citibankonlline.com")

    def test_exact_host_listing_flags(self):
        self.assertEqual(match_phish_feed("ocbc-secure-login.xyz", self.FEED),
                         "ocbc-secure-login.xyz")

    def test_clean_domain_not_in_feed_is_no_hit(self):
        self.assertIsNone(match_phish_feed("dbs.com.sg", self.FEED))

    def test_shared_host_never_flags_off_a_sibling(self):
        # The fixture sits on vercel.app; an unrelated phishing vercel.app sub
        # in the feed must NOT make us flag the whole platform.
        self.assertIsNone(match_phish_feed("vercel.app", self.FEED))

    def test_empty_term_is_no_hit(self):
        self.assertIsNone(match_phish_feed("", self.FEED))


if __name__ == "__main__":
    unittest.main()
