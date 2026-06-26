#!/usr/bin/env python3
"""Fine-tune NLLB/Marian on domain-specific translation data."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import yaml
HAS_ML = False
load_from_disk = None

if os.environ.get("FORCE_MOCK") != "1":
    try:
        from datasets import load_from_disk
        from transformers import (
            AutoModelForSeq2SeqLM,
            AutoTokenizer,
            DataCollatorForSeq2Seq,
            Seq2SeqTrainer,
            Seq2SeqTrainingArguments,
        )
        import torch
        HAS_ML = True
    except ImportError:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune translation model")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--data", default="./data/tokenized/dataset")
    parser.add_argument("--domain", default="general")
    parser.add_argument("--output", default="./output")
    args = parser.parse_args()

    with open(args.config, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    output_dir = Path(args.output) / args.domain
    output_dir.mkdir(parents=True, exist_ok=True)
    final_dir = output_dir / "final"

    if not HAS_ML or os.environ.get("FORCE_MOCK") == "1":
        print("[WARNING] ML dependencies (transformers, datasets, torch) not found. Running in MOCK training mode.")
        final_dir.mkdir(parents=True, exist_ok=True)
        with open(final_dir / "pytorch_model.bin", "w", encoding="utf-8") as f:
            f.write("mock_model_weights_binary\n")
        with open(final_dir / "config.json", "w", encoding="utf-8") as f:
            json.dump({
                "model_type": "nllb",
                "vocab_size": 256206,
                "domain": args.domain,
                "base_model": config["project"]["base_model"]
            }, f)
        print(f"Model saved to {final_dir} (MOCK)")
        return

    train_cfg = config["training"]
    base_model = config["project"]["base_model"]

    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForSeq2SeqLM.from_pretrained(base_model)
    dataset = load_from_disk(args.data)

    split = dataset.train_test_split(test_size=0.05, seed=42)
    collator = DataCollatorForSeq2Seq(tokenizer=tokenizer, model=model)

    training_args = Seq2SeqTrainingArguments(
        output_dir=str(output_dir),
        max_steps=train_cfg["max_steps"],
        per_device_train_batch_size=train_cfg["batch_size"],
        learning_rate=train_cfg["learning_rate"],
        warmup_steps=train_cfg["warmup_steps"],
        eval_steps=train_cfg["eval_steps"],
        save_steps=train_cfg["save_steps"],
        evaluation_strategy="steps",
        save_total_limit=2,
        predict_with_generate=True,
        fp16=train_cfg.get("fp16", False),
        logging_steps=100,
        report_to="none",
    )

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        data_collator=collator,
        tokenizer=tokenizer,
    )

    trainer.train()
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))

    print(f"Model saved to {final_dir}")


if __name__ == "__main__":
    main()
