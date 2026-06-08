export const dynamic = 'force-dynamic';

// ─── DISABLED: ADMS Catch-All ──────────────────────────────────────────────────
// The ZKTeco device does NOT support ADMS. This catch-all route only returns
// "OK" so the device never receives an error response. No data is processed.

export async function GET() {
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST() {
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
