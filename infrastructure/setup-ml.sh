#!/bin/bash
# AuraTranslator ML Service — GCP Infrastructure Extension
# Run after infrastructure/setup.sh

set -euo pipefail

PROJECT_ID="codelabs-1-491815"
REGION="us-central1"
BUCKET="auratranslator-models"
SA_NAME="auratranslator-sa"

echo "Setting up ML infrastructure for AuraTranslator v2..."

gcloud config set project "$PROJECT_ID"

# Enable Vertex AI and Storage APIs
gcloud services enable \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  --quiet

# Create model storage bucket
gsutil mb -l "$REGION" "gs://${BUCKET}" 2>/dev/null || echo "Bucket already exists"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant ML permissions
for ROLE in \
  "roles/storage.objectAdmin" \
  "roles/aiplatform.user"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

echo "✅ ML infrastructure ready"
echo "   Model bucket: gs://${BUCKET}"
echo "   Deploy ML service: see docs/DEPLOYMENT.md"
