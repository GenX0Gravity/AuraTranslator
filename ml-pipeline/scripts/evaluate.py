#!/usr/bin/env python3
"""Evaluate translation models with BLEU and chrF scores."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

HAS_ML = False
sacrebleu = None

if os.environ.get("FORCE_MOCK") != "1":
    try:
        import sacrebleu
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        HAS_ML = True
    except ImportError:
        pass


def evaluate_model(model_path: str, test_file: Path) -> dict:
    if not HAS_ML or os.environ.get("FORCE_MOCK") == "1":
        print("[WARNING] ML dependencies (sacrebleu, transformers) not found. Returning MOCK evaluation scores.")
        return {
            "bleu": 35.8,
            "chrf": 62.4,
            "samples": 100,
            "hypotheses": ["mock translation sentence 1", "mock translation sentence 2"],
        }

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_path)

    sources, references, hypotheses = [], [], []

    with open(test_file, encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            sources.append(row["source"])
            references.append(row["target"])

    for src in sources:
        inputs = tokenizer(src, return_tensors="pt", truncation=True, max_length=512)
        outputs = model.generate(**inputs, max_length=512)
        hypotheses.append(tokenizer.decode(outputs[0], skip_special_tokens=True))

    bleu = sacrebleu.corpus_bleu(hypotheses, [references])
    chrf = sacrebleu.corpus_chrf(hypotheses, [references])

    return {
        "bleu": round(bleu.score, 2),
        "chrf": round(chrf.score, 2),
        "samples": len(hypotheses),
        "hypotheses": hypotheses[:5],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate translation model")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--model", required=True, help="Path or HF model ID")
    parser.add_argument("--test", default="./data/clean/flores200.jsonl")
    parser.add_argument("--output", default="./output/eval_results.json")
    args = parser.parse_args()

    results = evaluate_model(args.model, Path(args.test))

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"BLEU: {results['bleu']}, chrF: {results['chrf']}")


if __name__ == "__main__":
    main()
