#!/bin/bash
# =============================================================
# AuraTranslator — GCP Infrastructure Setup Script
# Run once to provision all required GCP resources
# Usage: bash infrastructure/setup.sh
# =============================================================

set -euo pipefail

PROJECT_ID="codelabs-1-491815"
REGION="us-central1"
SERVICE_NAME="auratranslator"
SA_NAME="auratranslator-sa"
REPO_NAME="auratranslator-repo"
GITHUB_REPO="GenX0Gravity/AuraTranslator"

echo "=================================================="
echo "AuraTranslator GCP Setup — Project: $PROJECT_ID"
echo "=================================================="

# Set active project
gcloud config set project "$PROJECT_ID"

# ── Enable Required APIs ──────────────────────────────────────
echo "📦 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --quiet

echo "✅ APIs enabled"

# ── Create Artifact Registry Repository ──────────────────────
echo "🗂  Creating Artifact Registry repository..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="AuraTranslator Docker images" \
  --quiet 2>/dev/null || echo "ℹ  Repository already exists"

# ── Create Service Account ────────────────────────────────────
echo "👤 Creating service account..."
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="AuraTranslator Cloud Run SA" \
  --quiet 2>/dev/null || echo "ℹ  Service account already exists"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant permissions to service account
echo "🔑 Granting IAM permissions..."
for ROLE in \
  "roles/datastore.user" \
  "roles/secretmanager.secretAccessor" \
  "roles/artifactregistry.reader" \
  "roles/logging.logWriter" \
  "roles/monitoring.metricWriter" \
  "roles/cloudtrace.agent"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

echo "✅ IAM permissions granted"

# ── Initialize Firestore ──────────────────────────────────────
echo "🔥 Initializing Firestore..."
gcloud firestore databases create \
  --location="$REGION" \
  --quiet 2>/dev/null || echo "ℹ  Firestore already initialized"

# ── Create Secrets in Secret Manager ─────────────────────────
echo "🔐 Creating Secret Manager secrets..."
echo "   Please enter your secret values (press Enter to skip if already set):"

create_secret() {
  local SECRET_NAME=$1
  local PROMPT=$2
  
  if gcloud secrets describe "$SECRET_NAME" --quiet 2>/dev/null; then
    echo "  ℹ  Secret '$SECRET_NAME' already exists"
  else
    echo -n "  $PROMPT: "
    read -rs SECRET_VALUE
    echo ""
    if [ -n "$SECRET_VALUE" ]; then
      echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
        --data-file=- \
        --replication-policy=automatic \
        --quiet
      echo "  ✅ Created secret '$SECRET_NAME'"
    else
      echo "  ⚠  Skipped '$SECRET_NAME' — set it manually later"
    fi
  fi
}

create_secret "GOOGLE_TRANSLATE_API_KEY" "Google Translate API Key"
create_secret "GEMINI_API_KEY" "Gemini API Key"
create_secret "NEXTAUTH_SECRET" "NextAuth Secret (run: openssl rand -base64 32)"
create_secret "GOOGLE_CLIENT_ID" "Google OAuth Client ID"
create_secret "GOOGLE_CLIENT_SECRET" "Google OAuth Client Secret"

# ── Workload Identity Federation for GitHub Actions ───────────
echo "🔗 Setting up Workload Identity Federation..."
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"

gcloud iam workload-identity-pools create "$POOL_NAME" \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --quiet 2>/dev/null || echo "ℹ  WIF pool already exists"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
  --workload-identity-pool="$POOL_NAME" \
  --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
  --quiet 2>/dev/null || echo "ℹ  WIF provider already exists"

POOL_ID=$(gcloud iam workload-identity-pools describe "$POOL_NAME" \
  --location=global \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  --quiet

PROVIDER_FULL=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --workload-identity-pool="$POOL_NAME" \
  --location=global \
  --format="value(name)")

echo ""
echo "=================================================="
echo "✅ GCP Infrastructure Setup Complete!"
echo "=================================================="
echo ""
echo "Add these secrets to your GitHub repository"
echo "(Settings → Secrets → Actions):"
echo ""
echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = $PROVIDER_FULL"
echo "  GCP_SERVICE_ACCOUNT            = $SA_EMAIL"
echo ""
echo "Firebase Project ID: $PROJECT_ID"
echo "Cloud Run region:    $REGION"
echo "Artifact Registry:   ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
echo ""
echo "Next: Push to main branch to trigger deployment!"
