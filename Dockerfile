# Stage 1: DEPENDENCIES + BUILD
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl libc6-compat python3 make g++
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm pm2

# Copy package files for layer caching
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install ALL deps (including devDeps needed for build)
RUN pnpm install --frozen-lockfile --config.ignore-scripts=false

# Copy source code
COPY . .

# Build-time args
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_DB_ON_BUILD=true

# Build Next.js + compile worker
RUN pnpm run build 2>&1 && echo "Build complete"

# ── Stage 2: RUNNER ────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl libc6-compat netcat-openbsd

WORKDIR /app

# Install runtime tools
RUN npm install -g pnpm pm2 tsx

# Copy package files for production install
COPY package.json pnpm-lock.yaml ./

# Copy prisma schema BEFORE installing
COPY prisma ./prisma/

# Install ONLY production dependencies
RUN pnpm install --prod --frozen-lockfile --config.ignore-scripts=false && \
    pnpm store prune

# Copy built artifacts from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/scripts ./src/scripts
COPY --from=builder /app/ecosystem.config.js ./
COPY --from=builder /app/entrypoint.sh ./
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN chmod +x entrypoint.sh

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
