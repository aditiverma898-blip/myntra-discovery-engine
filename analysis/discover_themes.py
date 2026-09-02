"""Offline lexical clustering contract for user-operated or fixture evidence.

No network or model provider is imported. Input and output are JSONL/JSON files.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def discover(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        for theme_id in row.get("themeIds", []):
            grouped[theme_id].append(row)
    clusters = []
    for theme_id in sorted(grouped):
        words = Counter()
        evidence_ids = []
        for row in grouped[theme_id]:
            evidence_ids.append(row["evidenceId"])
            words.update(word for word in row.get("normalizedText", "").lower().split() if len(word) >= 4)
        clusters.append({
            "clusterId": f"lexical-{theme_id}",
            "label": theme_id,
            "evidenceIds": sorted(evidence_ids),
            "topTerms": [word for word, _ in words.most_common(6)],
        })
    return clusters


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.input.read_text(encoding="utf-8").splitlines() if line]
    args.output.write_text(json.dumps(discover(rows), indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
