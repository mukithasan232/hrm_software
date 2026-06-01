import "dotenv/config";
import { defineConfig } from "prisma/config";

// ─── IPv6 localhost fix ────────────────────────────────────────────────────────
// On Hostinger LiteSpeed (and some Linux VPS), `localhost` resolves to ::1 (IPv6)
// but MariaDB only listens on 127.0.0.1 (IPv4). This causes `prisma db push`
// to hang with "pool timeout (active=0, idle=0)". Force IPv4 explicitly.
function getFixedUrl(): string {
  const raw = process.env.DATABASE_URL || '';
  return raw.replace(
    /\/\/(.*?)@localhost(:\d+)?\//,
    (_, creds, port) => `//${creds}@127.0.0.1${port || ':3306'}/`
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: getFixedUrl() || process.env.DATABASE_URL || '',
  },
});