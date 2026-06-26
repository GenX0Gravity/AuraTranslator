# Deployment Guide — AuraTranslator v2

## Prerequisites

- Google Cloud Project with billing enabled
- Node.js 20+
- Python 3.11+ (for ML service locally)
- Docker & Docker Compose
- GPU optional (CUDA 12.1 for local ML inference)

## Local Development

### 1. Next.js App Only (API fallback mode)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without `ML_SERVICE_URL`, the router uses Google/LibreTranslate/free API fallbacks.

### 2. Full Stack (App + ML Service)

```bash
# Start both services
docker compose up --build

# App: http://localhost:3000
# ML Service: http://localhost:8090
```

Set in `.env.local`:
```
ML_SERVICE_URL=http://localhost:8090
```

### 3. GPU ML Service

```bash
docker compose --profile gpu up ml-service-gpu
```

## Google Cloud Deployment

### Step 1: Infrastructure Setup

```bash
bash infrastructure/setup.sh
bash infrastructure/setup-ml.sh
```

### Step 2: Deploy ML Service

Push to `master` with changes in `ml-service/` or run manually:

```bash
gcloud builds submit ml-service \
  --tag us-central1-docker.pkg.dev/codelabs-1-491815/auratranslator-repo/auratranslator-ml:latest

gcloud run deploy auratranslator-ml \
  --image us-central1-docker.pkg.dev/codelabs-1-491815/auratranslator-repo/auratranslator-ml:latest \
  --region us-central1 \
  --memory 8Gi --cpu 4 --timeout 300 \
  --no-allow-unauthenticated
```

### Step 3: Deploy Next.js App

The main `deploy.yml` workflow sets `ML_SERVICE_URL` automatically.

### Step 4: Vertex AI Fine-tuning (Optional)

```bash
cd ml-pipeline
pip install -r requirements.txt
python scripts/collect_data.py
python scripts/clean_data.py
python scripts/tokenize.py
python scripts/train.py --domain legal
python scripts/evaluate.py --model ./output/legal/final
python scripts/deploy_model.py --model ./output/legal/final --domain legal --gcs-bucket auratranslator-models
```

### Step 5: Automated Retraining

Schedule weekly via Cloud Scheduler:

```bash
gcloud scheduler jobs create http auratranslator-retrain \
  --schedule="0 2 * * 0" \
  --uri="https://YOUR-TRAINING-TRIGGER-URL/retrain" \
  --http-method=POST
```

Or run manually:

```bash
python ml-pipeline/scripts/retrain.py --domain general --min-corrections 100
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ML_SERVICE_URL` | Recommended | Open-source ML inference service URL |
| `GOOGLE_TRANSLATE_API_KEY` | Fallback | Google Cloud Translation API |
| `GEMINI_API_KEY` | Optional | Quality scoring |
| `LIBRETRANSLATE_API_URL` | Optional | LibreTranslate instance |
| `GCS_MODEL_BUCKET` | Training | Model artifact storage |
| `DOMAIN_MODEL_DIR` | ML Service | Path to fine-tuned domain models |

## Production URLs

| Service | URL |
|---------|-----|
| **App** | https://auratranslator-694414640481.us-central1.run.app |
| **ML Service** | Deploy via `deploy-ml.yml` → set as `ML_SERVICE_URL` |
| **Health** | `/api/health` |
| **Models API** | `/api/models?source=en&target=hi` |
| **Benchmark** | `POST /api/benchmark` |

## Monitoring

- Cloud Run metrics: latency, instance count, error rate
- Cloud Logging: structured logs from `@/lib/logger`
- Translation confidence displayed in UI per request
- Firestore `translation_corrections` collection for learning metrics
