#!/usr/bin/env python3
"""Tokenize cleaned data for model training."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import yaml
HAS_ML = False
Dataset = None
AutoTokenizer = None

if os.environ.get("FORCE_MOCK") != "1":
    try:
        from datasets import Dataset
        from transformers import AutoTokenizer
        HAS_ML = True
    except ImportError:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Tokenize translation data")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--input", default="./data/clean")
    parser.add_argument("--output", default="./data/tokenized")
    args = parser.parse_args()

    with open(args.config, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    input_dir = Path(args.input)
    all_records = []
    for jsonl in input_dir.glob("*.jsonl"):
        with open(jsonl, encoding="utf-8") as f:
            for line in f:
                try:
                    all_records.append(json.loads(line))
                except Exception:
                    pass

    if not HAS_ML or os.environ.get("FORCE_MOCK") == "1":
        print("[WARNING] ML dependencies (transformers, datasets) not found. Running in MOCK tokenization mode.")
        # Create mock directories to satisfy downstream steps
        (output_dir / "dataset").mkdir(parents=True, exist_ok=True)
        with open(output_dir / "dataset" / "mock_dataset.txt", "w", encoding="utf-8") as f:
            f.write(f"Mock tokenized data of {len(all_records)} records\n")
        (output_dir / "tokenizer").mkdir(parents=True, exist_ok=True)
        with open(output_dir / "tokenizer" / "vocab.json", "w", encoding="utf-8") as f:
            json.dump({"mock": 1}, f)
        print(f"Mock tokenized {len(all_records)} samples -> {output_dir}")
        return

    base_model = config["project"]["base_model"]
    max_length = config["training"]["max_length"]
    tokenizer = AutoTokenizer.from_pretrained(base_model)

    ds = Dataset.from_list(all_records)

    def preprocess(batch):
        inputs = tokenizer(batch["source"], max_length=max_length, truncation=True)
        with tokenizer.as_target_tokenizer():
            labels = tokenizer(batch["target"], max_length=max_length, truncation=True)
        inputs["labels"] = labels["input_ids"]
        return inputs

    tokenized = ds.map(preprocess, batched=True, remove_columns=ds.column_names)
    tokenized.save_to_disk(str(output_dir / "dataset"))
    tokenizer.save_pretrained(str(output_dir / "tokenizer"))

    print(f"Tokenized {len(all_records)} samples -> {output_dir}")


if __name__ == "__main__":
    main()
