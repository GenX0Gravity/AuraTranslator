#!/bin/bash
# setup-scheduler.sh
# Provisions a Google Cloud Scheduler job to trigger the AuraTranslator monthly retraining pipeline.

set -euo pipefail

# Configuration Defaults
JOB_NAME="auratranslator-monthly-retrain"
SCHEDULE="0 2 1 * *" # Monthly: at 02:00 on the first day of the month
TIME_ZONE="UTC"
LOCATION="us-central1"
SECRET_TOKEN="monthly-retrain-secret-token"
DOMAIN="general"

# Print usage
usage() {
  echo "Usage: $0 --uri <target-endpoint-url> [options]"
  echo ""
  echo "Required:"
  echo "  -u, --uri URL            The App's API route URL (e.g. https://translator.example.com/api/models/retrain)"
  echo ""
  echo "Options:"
  echo "  -n, --name NAME          Cloud Scheduler Job Name (default: $JOB_NAME)"
  echo "  -s, --schedule CRON      Cron schedule (default: '$SCHEDULE')"
  echo "  -t, --token TOKEN        Authorization Bearer token (default: $SECRET_TOKEN)"
  echo "  -d, --domain DOMAIN      Retraining domain/general corpus to trigger (default: $DOMAIN)"
  echo "  -l, --location REGION    GCP Location region (default: $LOCATION)"
  echo "  -h, --help               Show this help message"
  exit 1
}

TARGET_URI=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -u|--uri)
      TARGET_URI="$2"
      shift 2
      ;;
    -n|--name)
      JOB_NAME="$2"
      shift 2
      ;;
    -s|--schedule)
      SCHEDULE="$2"
      shift 2
      ;;
    -t|--token)
      SECRET_TOKEN="$2"
      shift 2
      ;;
    -d|--domain)
      DOMAIN="$2"
      shift 2
      ;;
    -l|--location)
      LOCATION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

if [ -z "$TARGET_URI" ]; then
  echo "Error: Target API URI is required."
  usage
fi

echo "=========================================================="
echo "Creating/Updating Cloud Scheduler Job for AuraTranslator"
echo "=========================================================="
echo "Job Name:    $JOB_NAME"
echo "Schedule:    $SCHEDULE"
echo "Time Zone:   $TIME_ZONE"
echo "Location:    $LOCATION"
echo "Target URI:  $TARGET_URI"
echo "Domain:      $DOMAIN"
echo "=========================================================="

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
  echo "Error: gcloud CLI is not installed or not in PATH."
  exit 1
fi

# Attempt to create the job. If it already exists, update it.
if gcloud scheduler jobs describe "$JOB_NAME" --location="$LOCATION" &> /dev/null; then
  echo "Job already exists. Updating existing Cloud Scheduler job..."
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location="$LOCATION" \
    --schedule="$SCHEDULE" \
    --uri="$TARGET_URI" \
    --http-method=POST \
    --headers="Content-Type=application/json,Authorization=Bearer $SECRET_TOKEN" \
    --message-body="{\"domain\": \"$DOMAIN\"}" \
    --time-zone="$TIME_ZONE"
else
  echo "Creating new Cloud Scheduler job..."
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location="$LOCATION" \
    --schedule="$SCHEDULE" \
    --uri="$TARGET_URI" \
    --http-method=POST \
    --headers="Content-Type=application/json,Authorization=Bearer $SECRET_TOKEN" \
    --message-body="{\"domain\": \"$DOMAIN\"}" \
    --time-zone="$TIME_ZONE"
fi

echo "Success: Monthly model retraining Cloud Scheduler job has been successfully provisioned!"
