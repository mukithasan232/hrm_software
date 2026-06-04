FROM node:22-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Enable pnpm
RUN corepack enable pnpm

WORKDIR /app

# 1. Install ALL dependencies (Don't set NODE_ENV=production yet!)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm config set ignore-scripts false && pnpm install --frozen-lockfile

# Copy all files
COPY . .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

# 2. Build Next.js FIRST (while devDependencies are still available)
RUN npx prisma generate && npx next build

# 3. NOW set production environment for optimized runtime
ENV NODE_ENV=production

# Expose the correct port
EXPOSE 3000
ENV PORT=3000

# Use the entrypoint script
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]