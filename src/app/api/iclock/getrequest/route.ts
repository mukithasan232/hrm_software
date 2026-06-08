export const dynamic = 'force-dynamic';

// ─── DISABLED: ADMS Get-Request ───────────────────────────────────────────────
// The ZKTeco device does NOT support ADMS. This endpoint only returns "OK"
// to acknowledge any device poll requests. No commands are dispatched.

export async function GET() {
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
