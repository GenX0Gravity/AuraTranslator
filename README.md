# 🌐 AuraTranslator — AI-Powered Enterprise Translation Platform

<div align="center">

![AuraTranslator](https://img.shields.io/badge/AuraTranslator-v1.0.0-6366f1?style=for-the-badge&logo=google-translate)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=for-the-badge&logo=firebase)
![Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-deployed-4285F4?style=for-the-badge&logo=googlecloud)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

**A next-generation, enterprise-grade translation platform powered by Google Translate API, Gemini AI, and Firebase — deployed on Google Cloud Run.**

[🚀 Live App](https://auratranslator-694414640481.us-central1.run.app) • [📖 API Docs](docs/API.md) • [🏗 Architecture](docs/ARCHITECTURE.md) • [🚢 Deployment](docs/DEPLOYMENT.md)

</div>

---

## ✨ Features

| Feature | Status |
|---------|--------|
| 🤖 AI Text Translation (Google Translate + Gemini fallback) | ✅ |
| 🔍 Automatic Language Detection | ✅ |
| 🎙️ Speech-to-Text (Web Speech API) | ✅ |
| 🔊 Text-to-Speech with voice/rate/gender control | ✅ |
| 📄 OCR Translation (PNG, JPG, JPEG via Tesseract.js) | ✅ |
| 🖼️ Image Translation | ✅ |
| 📑 PDF Translation (streaming progress) | ✅ |
| 📝 DOCX Translation | ✅ |
| 🕐 Translation History (Firestore-persisted) | ✅ |
| ↔️ Language Swapping | ✅ |
| 🌙 Dark Mode | ✅ |
| 📱 Mobile Responsive | ✅ |
| 🔐 Authentication (Google OAuth + Email/Password) | ✅ |
| 👤 User Profiles | ✅ |
| 📊 Analytics Dashboard | ✅ |
| ⭐ Favorites System | ✅ |
| 🧠 Translation Memory | ✅ |
| 🔄 Batch Translation | ✅ |
| 📚 Language Learning Module | ✅ |
| 🏢 Workspace Collaboration | ✅ |
| 📥 Export History (PDF / CSV / DOCX) | ✅ |
| ⭐ Translation Quality Scoring (Gemini AI) | ✅ |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client (Browser)                   │
│  Next.js 16 + React 19 + TailwindCSS v4             │
│  Web Speech API │ IndexedDB (offline cache)          │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────┐
│              Google Cloud Run (us-central1)           │
│  Next.js App Server (Node 20, standalone mode)       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐   │
│  │  API Routes  │  │  Middleware  │  │  Rate     │   │
│  │  (Zod + ADC) │  │  (Logging)  │  │  Limiter  │   │
│  └──────┬──────┘  └──────────────┘  └───────────┘   │
└─────────┼───────────────────────────────────────────┘
          │
    ┌─────┼──────────────────────────────┐
    │     │         GCP Services          │
    │  ┌──▼──────┐  ┌────────────────┐   │
    │  │Firestore│  │ Secret Manager │   │
    │  │  (DB)   │  │   (Secrets)    │   │
    │  └─────────┘  └────────────────┘   │
    │  ┌─────────┐  ┌────────────────┐   │
    │  │ Cloud   │  │  Artifact      │   │
    │  │Logging  │  │  Registry      │   │
    │  └─────────┘  └────────────────┘   │
    └────────────────────────────────────┘
          │
    ┌─────▼──────────────────────────────┐
    │       External APIs                │
    │  Google Translate API              │
    │  Gemini AI (gemini-2.5-flash)      │
    │  LibreTranslate (fallback)         │
    └────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- A Google Cloud Project with billing enabled
- Firebase project (same GCP project)
- Google Translate API key
- Gemini API key

### 1. Clone & Install

```bash
git clone https://github.com/GenX0Gravity/AuraTranslator.git
cd AuraTranslator
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

### 3. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your GCP project (`codelabs-1-491815`)
3. Enable **Firestore** (Native mode)
4. Create a Web App and copy the config to `.env.local`
5. For local dev: Download a service account key JSON, base64-encode it:
   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```
   Paste the result as `FIREBASE_SERVICE_ACCOUNT_KEY` in `.env.local`

### 4. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🌍 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase Auth Domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | GCP / Firebase Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage Bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase Messaging ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Firebase App ID |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 🔧 Local | Base64 service account JSON (Cloud Run uses ADC) |
| `GOOGLE_TRANSLATE_API_KEY` | ✅ | Google Cloud Translation API key |
| `GEMINI_API_KEY` | ✅ | Google Gemini AI API key |
| `NEXTAUTH_SECRET` | ✅ | Random string for JWT signing |
| `NEXTAUTH_URL` | ✅ | Full app URL (e.g., `https://your-app.run.app`) |
| `GOOGLE_CLIENT_ID` | 🔧 Auth | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 🔧 Auth | Google OAuth Client Secret |
| `LIBRETRANSLATE_API_KEY` | ❌ Optional | LibreTranslate fallback key |
| `NEXT_PUBLIC_APP_URL` | ❌ Optional | Public app URL for batch API |

---

## 🚢 Deployment

### Google Cloud Run (Production)

To deploy AuraTranslator automatically on Google Cloud Run via GitHub Actions, follow these steps:

1. **Run the infrastructure setup script (first time only):**
   ```bash
   bash infrastructure/setup.sh
   ```

2. **Add Workload Identity Federation (WIF) secrets to your GitHub repository** (Settings → Secrets and variables → Actions → Repository Secrets):
   * **`GCP_SERVICE_ACCOUNT`**: `auratranslator-sa@codelabs-1-491815.iam.gserviceaccount.com`
   * **`GCP_WORKLOAD_IDENTITY_PROVIDER`**: `projects/694414640481/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider`

3. **Populate secrets in GCP Secret Manager:**
   The application uses GCP Secret Manager to securely manage environment variables. Since initial placeholder values are created during setup, you **MUST** go to the Google Cloud Console and populate these secrets with real credentials:
   * `GOOGLE_TRANSLATE_API_KEY`: Your Google Cloud Translation API key.
   * `GEMINI_API_KEY`: Your Google Gemini API key.
   * `NEXTAUTH_SECRET`: A secure random string for signing JWT tokens.
   * `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Credentials for Google OAuth login.

4. **Push to the repository:**
   The deployment workflow will run automatically on push.
   ```bash
   git push origin master
   ```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

### Manual Deploy (without CI/CD)

```bash
# Build Docker image
docker build -t auratranslator .

# Push to Artifact Registry
docker tag auratranslator us-central1-docker.pkg.dev/codelabs-1-491815/auratranslator-repo/auratranslator:latest
docker push us-central1-docker.pkg.dev/codelabs-1-491815/auratranslator-repo/auratranslator:latest

# Deploy to Cloud Run
gcloud run deploy auratranslator \
  --image us-central1-docker.pkg.dev/codelabs-1-491815/auratranslator-repo/auratranslator:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GOOGLE_TRANSLATE_API_KEY=GOOGLE_TRANSLATE_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"
```

---

## 🔐 Security

- **OWASP Top 10** compliance
- **CSP headers** (Content-Security-Policy)
- **HSTS** (HTTP Strict Transport Security)
- **Rate limiting** (IP-based token bucket: 60/min translate, 10/min AI scoring)
- **Zod input validation** on all API routes
- **No secret leakage** in error messages
- **Workload Identity Federation** (no long-lived GCP credentials in CI/CD)
- **Secrets in Secret Manager** (never in environment files or code)
- **Non-root Docker user** (UID 1001)
- **bcrypt cost 12** for password hashing

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.9 (App Router) |
| UI | React 19 + TailwindCSS v4 |
| Icons | Lucide React |
| Charts | Recharts |
| Database | Google Firestore (via Firebase Admin SDK) |
| Auth | NextAuth v4 (Google OAuth + Credentials) |
| AI | Google Gemini 2.5 Flash |
| Translation | Google Translate API v2 + LibreTranslate |
| OCR | Tesseract.js |
| PDF | PDFKit (export) + pdf-parse (import) |
| DOCX | docx (export) + adm-zip (import) |
| Offline Cache | IndexedDB (idb-keyval) |
| Validation | Zod |
| Runtime | Node.js 20 |
| Container | Docker (multi-stage Alpine) |
| Cloud | Google Cloud Run + Firestore + Secret Manager + Artifact Registry |
| CI/CD | GitHub Actions + Workload Identity Federation |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main translator UI
│   ├── layout.tsx            # Root layout + NextAuth provider
│   ├── globals.css           # Global styles
│   ├── analytics/            # Analytics dashboard
│   ├── auth/                 # Login / Register pages
│   ├── batch/                # Batch translation
│   ├── conversation/         # Conversation mode
│   ├── learn/                # Language learning
│   ├── workspace/            # Team workspace
│   └── api/
│       ├── auth/             # NextAuth + registration
│       ├── export/           # PDF / CSV / DOCX export
│       ├── extract/          # OCR + document extraction
│       ├── favorites/        # User favorites
│       ├── health/           # Health check endpoint
│       ├── history/          # Translation history
│       ├── learn/            # AI language learning
│       └── translate/        # Core translation + batch + score
├── components/
│   ├── ErrorBoundary.tsx     # React error boundary
│   ├── HistorySidebar.tsx    # History panel
│   ├── LanguageSelector.tsx  # Language picker
│   ├── NextAuthProvider.tsx  # Auth session provider
│   └── ThemeToggle.tsx       # Dark/Light mode toggle
├── hooks/
│   └── useLocalStorage.ts    # Typed localStorage hook
├── lib/
│   ├── firebase.ts           # Firebase client SDK
│   ├── firebase-admin.ts     # Firebase Admin SDK (server)
│   ├── logger.ts             # Structured Cloud Logging
│   ├── rateLimit.ts          # IP-based token bucket
│   ├── retry.ts              # Exponential backoff utility
│   └── mongodb.ts            # Legacy (kept for reference)
├── middleware.ts             # Request logging + tracing
├── models/                   # Legacy Mongoose models (reference)
└── utils/
    ├── analytics.ts          # Client-side analytics tracking
    └── languages.ts          # Language codes + names
```

---

## 📝 License

MIT License — See [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ❤️ using Next.js, Firebase, and Google Cloud Platform
</div>
