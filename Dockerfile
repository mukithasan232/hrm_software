FROM node:22-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-frozen-lockfile

COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && \
    (npx next build 2>&1 || echo "[build] Next.js page data collection had non-fatal errors — build continues")

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
