#!/usr/bin/env python3
"""Automated retraining pipeline using collected datasets and Firestore corrections."""

from __future__ import annotations

import argparse
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path


def update_run_status(run_id: str, status: str, step: str, progress: int, **kwargs) -> None:
    print(f"[STATUS] Run {run_id} | Step: {step} | Progress: {progress}% | Status: {status}")
    if os.environ.get("FORCE_MOCK") != "1":
        try:
            from google.cloud import firestore
            db = firestore.Client()
            doc_ref = db.collection("model_training_runs").document(run_id)
            data = {
                "status": status,
                "currentStep": step,
                "progress": progress,
                "updatedAt": datetime.datetime.now(datetime.timezone.utc)
            }
            for k, v in kwargs.items():
                data[k] = v
            doc_ref.set(data, merge=True)
        except Exception as e:
            # Graceful fallback for local offline testing
            pass

    # Also update local runs_db.json for offline Next.js dev server updates
    try:
        local_db = Path("./data/runs_db.json")
        local_db.parent.mkdir(parents=True, exist_ok=True)
        runs_dict = {}
        if local_db.exists():
            try:
                with open(local_db, encoding="utf-8") as rf:
                    runs_list = json.load(rf)
                    # Convert list to dict keyed by ID
                    runs_dict = {r["id"]: r for r in runs_list if isinstance(r, dict) and "id" in r}
            except Exception:
                pass
        
        run_data = runs_dict.get(run_id, {
            "id": run_id,
            "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
        run_data.update({
            "status": status,
            "currentStep": step,
            "progress": progress,
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        for k, v in kwargs.items():
            if isinstance(v, datetime.datetime):
                run_data[k] = v.isoformat()
            else:
                run_data[k] = v
        runs_dict[run_id] = run_data
        
        # Sort and write last 15 runs
        sorted_runs = sorted(runs_dict.values(), key=lambda x: x.get("startedAt", ""), reverse=True)[:15]
        with open(local_db, "w", encoding="utf-8") as wf:
            json.dump(sorted_runs, wf, indent=2, ensure_ascii=False)
    except Exception as le:
        print(f"Failed to write to local runs_db.json: {le}")


def export_corrections_from_firestore(output: Path) -> int:
    if os.environ.get("FORCE_MOCK") == "1":
        print("Mock mode: skipping Firestore export for corrections.")
        local = Path("./data/corrections.jsonl")
        if local.exists():
            return sum(1 for _ in open(local, encoding="utf-8"))
        return 0
    try:
        from google.cloud import firestore
        db = firestore.Client()
        docs = (
            db.collection("translation_corrections")
            .where("usedForTraining", "==", False)
            .limit(10000)
            .stream()
        )
        count = 0
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w", encoding="utf-8") as f:
            for doc in docs:
                data = doc.to_dict()
                if data.get("correctedTranslation"):
                    f.write(json.dumps({
                        "source": data["sourceText"],
                        "target": data["correctedTranslation"],
                        "source_lang": data.get("sourceLang", "en"),
                        "target_lang": data.get("targetLang", "hi"),
                        "domain": data.get("domain", "general"),
                        "doc_id": doc.id,
                    }, ensure_ascii=False) + "\n")
                    count += 1
        return count
    except Exception as e:
        print(f"Firestore not available for corrections export: {e} — using local corrections file if any")
        local = Path("./data/corrections.jsonl")
        if local.exists():
            return sum(1 for _ in open(local, encoding="utf-8"))
        return 0


def mark_corrections_as_used(run_id: str) -> None:
    if os.environ.get("FORCE_MOCK") == "1":
        print("Mock mode: skipping marking corrections as used.")
        return
    try:
        from google.cloud import firestore
        db = firestore.Client()
        batch = db.batch()
        docs = (
            db.collection("translation_corrections")
            .where("usedForTraining", "==", False)
            .limit(500)
            .stream()
        )
        count = 0
        for doc in docs:
            batch.update(doc.reference, {"usedForTraining": True, "trainingRunId": run_id})
            count += 1
        if count > 0:
            batch.commit()
            print(f"Marked {count} corrections as used in Firestore.")
    except Exception as e:
        print(f"Skipped marking corrections as used: {e}")


def run_step(script: str, args: list[str]) -> None:
    cmd = [sys.executable, script] + args
    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Automated retraining pipeline")
    parser.add_argument("--domain", default="general")
    parser.add_argument("--min-corrections", type=int, default=100)
    parser.add_argument("--run-id")
    parser.add_argument("--full", action="store_true", help="Force full run on all datasets")
    parser.add_argument("--mock", action="store_true", help="Force mock run of the entire pipeline")
    args = parser.parse_args()

    if args.mock:
        os.environ["FORCE_MOCK"] = "1"

    # Generate timestamped run ID if not provided
    run_id = args.run_id or f"run_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    scripts_dir = Path(__file__).parent
    
    # Initialize dirs
    Path("./data").mkdir(parents=True, exist_ok=True)
    corrections_file = Path("./data/raw/corrections.jsonl")
    corrections_file.parent.mkdir(parents=True, exist_ok=True)

    update_run_status(
        run_id, 
        "RUNNING", 
        "collection", 
        0, 
        startedAt=datetime.datetime.now(datetime.timezone.utc),
        domain=args.domain
    )

    config_path = str((scripts_dir / ".." / "config.yaml").resolve())

    try:
        # Step 1: Export corrections & collect datasets
        print("\n=== STEP 1: DATA COLLECTION ===")
        corrections_count = export_corrections_from_firestore(corrections_file)
        print(f"Collected {corrections_count} Firestore corrections.")

        # Run collect_data.py to collect the 9 datasets
        run_step(str(scripts_dir / "collect_data.py"), [
            "--output", "./data/raw",
            "--config", config_path
        ])
        
        # Read collection summary to get stats
        collection_stats = {}
        summary_path = Path("./data/raw/collection_summary.json")
        if summary_path.exists():
            try:
                collection_stats = json.load(open(summary_path))["datasets"]
            except Exception:
                pass
        
        collection_stats["firestore_corrections"] = corrections_count

        update_run_status(
            run_id,
            "RUNNING",
            "cleaning",
            15,
            datasetStats=collection_stats
        )

        # Step 2: Clean data
        print("\n=== STEP 2: DATA CLEANING ===")
        run_step(str(scripts_dir / "clean_data.py"), [
            "--input", "./data/raw",
            "--output", "./data/clean"
        ])

        update_run_status(
            run_id,
            "RUNNING",
            "deduplication",
            30
        )

        # Step 3: Deduplication
        print("\n=== STEP 3: DEDUPLICATION ===")
        run_step(str(scripts_dir / "deduplicate.py"), [
            "--input", "./data/clean",
            "--output", "./data/deduplicated"
        ])

        update_run_status(
            run_id,
            "RUNNING",
            "training",
            45
        )

        # Step 4: Tokenization & Preprocessing
        print("\n=== STEP 4: TOKENIZATION ===")
        run_step(str(scripts_dir / "tokenize.py"), [
            "--input", "./data/deduplicated",
            "--output", "./data/tokenized",
            "--config", config_path
        ])

        update_run_status(
            run_id,
            "RUNNING",
            "training",
            55
        )

        # Step 5: Training
        print("\n=== STEP 5: MODEL TRAINING ===")
        # Note: In a test environment, max_steps in config.yaml is overridden or kept small
        run_step(str(scripts_dir / "train.py"), [
            "--data", "./data/tokenized/dataset",
            "--domain", args.domain,
            "--config", config_path
        ])

        update_run_status(
            run_id,
            "RUNNING",
            "evaluation",
            85
        )

        # Step 6: Evaluation
        print("\n=== STEP 6: EVALUATION ===")
        run_step(str(scripts_dir / "evaluate.py"), [
            "--model", f"./output/{args.domain}/final",
            "--test", "./data/clean/flores200.jsonl",
            "--output", "./output/eval_results.json",
            "--config", config_path
        ])

        eval_metrics = {"bleu": 0.0, "chrf": 0.0}
        eval_path = Path("./output/eval_results.json")
        if eval_path.exists():
            try:
                eval_metrics = json.load(open(eval_path))
            except Exception:
                pass

        update_run_status(
            run_id,
            "RUNNING",
            "deployment",
            95,
            metrics={"bleu": eval_metrics.get("bleu", 0.0), "chrf": eval_metrics.get("chrf", 0.0)}
        )

        # Step 7: Deployment
        print("\n=== STEP 7: MODEL DEPLOYMENT ===")
        run_step(str(scripts_dir / "deploy_model.py"), [
            "--model", f"./output/{args.domain}/final",
            "--domain", args.domain,
            "--local-target", "./models/domain"
        ])

        # Mark corrections as used
        mark_corrections_as_used(run_id)

        update_run_status(
            run_id,
            "COMPLETED",
            "complete",
            100,
            completedAt=datetime.datetime.now(datetime.timezone.utc),
            metrics={"bleu": eval_metrics.get("bleu", 0.0), "chrf": eval_metrics.get("chrf", 0.0)}
        )
        print("\n[SUCCESS] Retraining pipeline successfully completed!")

    except Exception as e:
        print(f"\n[ERROR] Retraining pipeline failed: {e}")
        update_run_status(
            run_id,
            "FAILED",
            "complete",
            100,
            error=str(e),
            completedAt=datetime.datetime.now(datetime.timezone.utc)
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
