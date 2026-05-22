FROM node:22-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-frozen-lockfile

COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
