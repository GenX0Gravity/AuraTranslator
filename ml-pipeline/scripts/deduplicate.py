#!/usr/bin/env python3
"""Globally deduplicate collected translation data across all datasets."""

import argparse
import json
from pathlib import Path
from tqdm import tqdm


def main() -> None:
    parser = argparse.ArgumentParser(description="Globally deduplicate translation datasets")
    parser.add_argument("--input", default="./data/clean")
    parser.add_argument("--output", default="./data/deduplicated")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    seen_pairs = set()
    total_records = 0
    unique_records = 0

    for jsonl in input_dir.glob("*.jsonl"):
        out_file = output_dir / jsonl.name
        records_to_keep = []

        with open(jsonl, encoding="utf-8") as f:
            for line in f:
                total_records += 1
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue

                src = row.get("source", "").strip()
                tgt = row.get("target", "").strip()
                key = (src, tgt)

                if key in seen_pairs:
                    continue

                seen_pairs.add(key)
                records_to_keep.append(row)
                unique_records += 1

        with open(out_file, "w", encoding="utf-8") as f:
            for r in records_to_keep:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

        print(f"Deduplicated {jsonl.name}: kept {len(records_to_keep)} records.")

    print(
        f"Global deduplication complete: total records = {total_records}, unique = {unique_records}, duplicates removed = {total_records - unique_records}"
    )


if __name__ == "__main__":
    main()
