#!/usr/bin/env python3
"""Deploy fine-tuned model to GCS and register with ML service."""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path


def deploy_local(model_dir: Path, domain: str, target: str = "/models/domain") -> None:
    dest = Path(target) / domain
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copytree(model_dir, dest, dirs_exist_ok=True)
    print(f"Deployed {model_dir} -> {dest}")


def deploy_gcs(model_dir: Path, bucket: str, domain: str) -> None:
    try:
        from google.cloud import storage
    except ImportError:
        raise SystemExit("Install google-cloud-storage for GCS deployment")

    client = storage.Client()
    bucket_ref = client.bucket(bucket)

    for file_path in model_dir.rglob("*"):
        if file_path.is_file():
            blob_name = f"domain/{domain}/{file_path.relative_to(model_dir)}"
            blob = bucket_ref.blob(blob_name)
            blob.upload_from_filename(str(file_path))
            print(f"Uploaded {blob_name}")

    print(f"Deployed to gs://{bucket}/domain/{domain}/")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy fine-tuned model")
    parser.add_argument("--model", required=True, help="Path to fine-tuned model")
    parser.add_argument("--domain", required=True)
    parser.add_argument("--gcs-bucket", default=os.environ.get("GCS_MODEL_BUCKET"))
    parser.add_argument("--local-target", default="/models/domain")
    args = parser.parse_args()

    model_dir = Path(args.model)
    if not model_dir.exists():
        raise SystemExit(f"Model not found: {model_dir}")

    deploy_local(model_dir, args.domain, args.local_target)

    if args.gcs_bucket:
        deploy_gcs(model_dir, args.gcs_bucket, args.domain)


if __name__ == "__main__":
    main()
