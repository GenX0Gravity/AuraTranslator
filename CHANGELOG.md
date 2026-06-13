# Changelog

All notable changes to AuraTranslator will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] — 2026-06-13

### 🎉 First Production Release

#### Added
- **Firebase/Firestore** integration replacing MongoDB — all history, users, favorites, translation memory, workspaces now persisted in Firestore
- **Firebase Admin SDK** with Application Default Credentials (ADC) for Cloud Run
- **Rate limiting** on all API endpoints (token bucket, IP-based)
  - `/api/translate`: 60 req/min
  - `/api/translate/score`: 10 req/min
  - `/api/extract`: 20 req/min
  - `/api/history`: 120 req/min
  - `/api/auth/register`: 10 per 15 min (brute-force protection)
- **Zod input validation** on all API routes with clear error messages
- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Next.js middleware** for request logging and tracing (Cloud Logging compatible)
- **Structured logger** (`src/lib/logger.ts`) with JSON output for Cloud Logging
- **Exponential backoff retry** utility (`src/lib/retry.ts`)
- **React Error Boundary** component with fallback UI and reset button
- **Health check endpoint** (`/api/health`) for Cloud Run readiness probes
- **Dockerfile** (multi-stage, Node 20 Alpine, non-root user, port 8080)
- **.dockerignore** (excludes secrets, tests, docs, node_modules)
- **GitHub Actions CI** workflow (lint, TypeScript typecheck, build, security audit)
- **GitHub Actions CD** workflow (Workload Identity Federation, Artifact Registry, Cloud Run deploy)
- **GCP infrastructure setup script** (`infrastructure/setup.sh`) with full automation
- **`next.config.ts`** standalone output mode for Docker builds
- **NEXTAUTH_URL** added to `.env.example`
- **bcrypt cost** upgraded from 10 to 12 in registration

#### Fixed
- **Critical**: `data.translatedText` referenced outside `try` scope in `page.tsx:291` — caused crashes for unauthenticated users saving translation history
- **Security**: API keys no longer included in client-facing error messages
- **Security**: Raw database/library errors no longer leak in API responses
- **TypeScript**: Replaced `any` types in auth route with proper interfaces
- **Reliability**: MongoDB connection no longer throws at module load time when `MONGODB_URI` is absent

#### Changed
- **Database**: MongoDB Atlas → Google Firestore (Firestore is GCP-native, no connection string needed in Cloud Run)
- **Auth route**: Migrated from Mongoose User model to Firestore `users` collection
- **History route**: Migrated from Mongoose History model to Firestore `history` collection
- **Export route**: Migrated from Mongoose + improved PDF formatting
- **Favorites route**: Migrated from Mongoose Favorite model to Firestore
- **Register route**: Input validation improved, bcrypt cost increased
- **Translate route**: Removed unused Glossary import, added TM lookup via Firestore, added rate limiting

#### Security
- OWASP Top 10 compliance review completed
- XSS prevention via CSP headers
- CSRF protection via SameSite cookies (NextAuth default)
- Input sanitization via Zod on all mutation endpoints
- Secrets managed via GCP Secret Manager (never in code or env files in production)
- Non-root Docker container user (UID 1001)
- Workload Identity Federation for GitHub Actions (no long-lived service account keys)

---

## [0.1.0] — Initial Development

- Initial project scaffold with Next.js 16 + React 19
- Core translation features (text, OCR, document)
- Speech-to-Text and Text-to-Speech
- MongoDB + Mongoose integration
- NextAuth with Google OAuth + Credentials
- Translation history, favorites, workspaces
- Analytics dashboard
- Dark mode
- Batch translation
- Language learning module
