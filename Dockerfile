# syntax=docker/dockerfile:1.7
# Stage 1: install build dependencies and compile application.
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl libc6-compat python3 make g++
WORKDIR /app

# Lockfile-only layer: stays cached for source-only changes.
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN --mount=type=cache,id=npm-builder,target=/root/.npm \
    npm ci --legacy-peer-deps --ignore-scripts

COPY . .
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    SKIP_DB_ON_BUILD=true
RUN npm run build

# Stage 2: retain production dependencies from builder; no second network install.
FROM node:22-alpine AS runner

# ts-node is required by server.cjs to transpile TypeScript at runtime
RUN apk add --no-cache openssl libc6-compat netcat-openbsd \
    && npm install -g pm2 tsx ts-node \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup
WORKDIR /app

COPY package.json package-lock.json ./
# Keep ALL node_modules — ts-node is a devDep needed by server.cjs at runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy runtime files
COPY --chown=appuser:appgroup --from=builder /app/.next ./.next
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist
COPY --chown=appuser:appgroup --from=builder /app/prisma ./prisma
COPY --chown=appuser:appgroup --from=builder /app/public ./public
# Copy full src/ — server.cjs loads TypeScript source files at runtime via ts-node
COPY --chown=appuser:appgroup --from=builder /app/src ./src
COPY --chown=appuser:appgroup --from=builder /app/ecosystem.config.js ./
COPY --chown=appuser:appgroup --from=builder /app/server.cjs ./
COPY --chown=appuser:appgroup --from=builder /app/entrypoint.sh ./
COPY --chown=appuser:appgroup --from=builder /app/next.config.ts ./next.config.ts
COPY --chown=appuser:appgroup --from=builder /app/tsconfig.json ./tsconfig.json
RUN chmod 755 entrypoint.sh

USER appuser
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
