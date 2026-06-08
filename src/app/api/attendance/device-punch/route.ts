export const dynamic = 'force-dynamic';

// ─── DISABLED: Local Device Push Webhook ──────────────────────────────────────
// The ZKTeco device does NOT support ADMS (push mode). All attendance data is
// fetched via the "Pull" method in zkService.ts (node-zklib).
// This endpoint is disabled to enforce pull-only data flow.

export async function POST() {
  return new Response(
    JSON.stringify({ success: false, message: 'Push webhook disabled — use pull sync instead.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}
