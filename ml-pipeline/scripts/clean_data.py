#!/usr/bin/env python3
"""Clean and normalize collected translation data."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from tqdm import tqdm


def clean_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text


def is_valid_pair(source: str, target: str, min_len: int = 3, max_len: int = 512) -> bool:
    if not source or not target:
        return False
    if len(source) < min_len or len(target) < min_len:
        return False
    if len(source) > max_len or len(target) > max_len:
        return False
    if source.lower() == target.lower():
        return False
    return True


def clean_file(input_path: Path, output_path: Path) -> dict:
    seen: set[tuple[str, str]] = set()
    kept = 0
    dropped = 0

    with open(input_path, encoding="utf-8") as fin, open(output_path, "w", encoding="utf-8") as fout:
        for line in tqdm(fin, desc=f"Cleaning {input_path.name}"):
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                dropped += 1
                continue

            source = clean_text(row.get("source", ""))
            target = clean_text(row.get("target", ""))

            if not is_valid_pair(source, target):
                dropped += 1
                continue

            key = (source, target)
            if key in seen:
                dropped += 1
                continue
            seen.add(key)

            row["source"] = source
            row["target"] = target
            fout.write(json.dumps(row, ensure_ascii=False) + "\n")
            kept += 1

    return {"kept": kept, "dropped": dropped}


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean translation datasets")
    parser.add_argument("--input", default="./data/raw")
    parser.add_argument("--output", default="./data/clean")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    stats = {}
    for jsonl in input_dir.glob("*.jsonl"):
        out = output_dir / jsonl.name
        stats[jsonl.name] = clean_file(jsonl, out)

    with open(output_dir / "cleaning_summary.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    print(f"Cleaning complete: {stats}")


if __name__ == "__main__":
    main()
