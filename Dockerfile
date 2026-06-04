FROM node:22-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --no-frozen-lockfile

# Copy all files
COPY . .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Environment variables
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client and Build Next.js
# Generate Prisma Client and Build Next.js (Failed loudly if error occurs)
RUN npx prisma generate && npx next build

# Expose the correct port
EXPOSE 3000
ENV PORT=3000

# Use the entrypoint script to automatically run migrations then start the server
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]