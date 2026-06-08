export const dynamic = 'force-dynamic';

// ─── DISABLED: ADMS Push Webhook ──────────────────────────────────────────────
// The ZKTeco device does NOT support ADMS (push mode). All attendance data is
// fetched via the "Pull" method in zkService.ts (node-zklib).
// These endpoints exist only to return "OK" so the device never sees an error
// if it attempts to push data. No data is processed or saved here.

export async function GET() {
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST() {
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
