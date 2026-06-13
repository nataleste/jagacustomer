"""Tests for dnstwist-style lookalike detection (no network, pure logic).

Run: .venv/bin/python -m unittest test_lookalike -v
"""
import unittest

from lookalike import lookalike_score

BRANDS = {
    "DBS": {"dbs.com.sg", "dbs.com", "posb.com.sg"},
    "OCBC": {"ocbc.com"},
}


class TestLookalikeScore(unittest.TestCase):
    def test_permutation_domain_scores_high_similarity(self):
        # The classic pig-butchering move: dbs-com.sg reads as dbs.com.sg.
        hit = lookalike_score("dbs-com.sg", BRANDS)
        self.assertEqual(hit["brand"], "DBS")
        self.assertEqual(hit["official"], "dbs.com.sg")
        self.assertGreaterEqual(hit["similarity"], 90)

    def test_brand_token_in_free_host_subdomain_is_flagged(self):
        hit = lookalike_score("dbs-secure.vercel.app", BRANDS)
        self.assertEqual(hit["brand"], "DBS")
        self.assertTrue(hit["contains_brand"])

    def test_genuine_official_domain_is_never_a_lookalike(self):
        self.assertIsNone(lookalike_score("www.dbs.com.sg", BRANDS))

    def test_unrelated_domain_is_clean(self):
        self.assertIsNone(lookalike_score("www.google.com", BRANDS))

    def test_brand_substring_inside_word_does_not_count(self):
        # "feedbson.com" contains the letters d-b-s but is not impersonating DBS.
        self.assertIsNone(lookalike_score("feedbson.com", BRANDS))


if __name__ == "__main__":
    unittest.main()
