import unittest

from analysis.discover_themes import discover


class DiscoverThemesTest(unittest.TestCase):
    def test_groups_evidence_by_theme_deterministically(self) -> None:
        rows = [
            {"evidenceId": "ev-2", "themeIds": ["fit"], "normalizedText": "size fit reviews"},
            {"evidenceId": "ev-1", "themeIds": ["fit", "trust"], "normalizedText": "size measurements trust"},
        ]
        clusters = discover(rows)
        self.assertEqual([cluster["label"] for cluster in clusters], ["fit", "trust"])
        self.assertEqual(clusters[0]["evidenceIds"], ["ev-1", "ev-2"])


if __name__ == "__main__":
    unittest.main()
