# Stage 1: DEPENDENCIES + BUILD
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl libc6-compat python3 make g++
WORKDIR /app

# Install pm2 globally
RUN npm install -g pm2

# Copy package files for layer caching
# Copy only npm package files. The wildcard handles if package-lock.json doesn't exist yet.
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install ALL deps using npm. The postinstall hook will run `prisma generate`.
# Use a cache mount to persist the npm cache between builds.
RUN --mount=type=cache,id=npm-builder,target=/root/.npm \
    npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build-time args
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_DB_ON_BUILD=true

# Build Next.js + compile worker using the script from package.json
RUN npm run build 2>&1 && echo "Build complete"

# ── Stage 2: RUNNER ────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl libc6-compat netcat-openbsd python3 make g++

WORKDIR /app

# Install runtime tools
RUN npm install -g pm2 tsx

# Copy package files for production install
COPY package.json package-lock.json* ./

# Copy prisma schema BEFORE installing
COPY prisma ./prisma/

# Install ONLY production dependencies using npm.
RUN --mount=type=cache,id=npm-runner,target=/root/.npm \
    npm install --omit=dev --legacy-peer-deps

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
