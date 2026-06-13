# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts && \
    # Keep dev deps separately for build
    cp -r node_modules /tmp/prod_modules && \
    npm ci --ignore-scripts

# ============================================================
# Stage 2: Builder
# ============================================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build environment — non-secret public vars baked in at build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ============================================================
# Stage 3: Runner (minimal production image)
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN apk add --no-cache \
    # Required by some npm packages
    libc6-compat \
    # Canvas/PDF support
    fontconfig \
    ttf-freefont && \
    # Create non-root user
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only production artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

# Healthcheck for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "server.js"]
