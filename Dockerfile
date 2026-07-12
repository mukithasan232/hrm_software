FROM node:22-alpine AS base

# Install system deps required by Prisma and native modules
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# ── Step 1: Install dependencies ─────────────────────────────────────────────
# Copy manifest files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Enable pnpm
RUN npm install -g pnpm

# COOLIFY FIX: Force development mode temporarily so devDependencies (TypeScript) install correctly
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Step 2: Copy source and set permissions ───────────────────────────────────
COPY . .
RUN chmod +x entrypoint.sh

# ── Step 3: Build ─────────────────────────────────────────────────────────────
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client, then build Next.js AND compile the worker
ENV NODE_ENV=production
ENV SKIP_DB_ON_BUILD=true
RUN pnpm run build

# ── Step 4: Runtime ───────────────────────────────────────────────────────────
RUN npm install -g pm2
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY ecosystem.config.js ./

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && pm2-runtime start ecosystem.config.js"]