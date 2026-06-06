export const dynamic = 'force-dynamic';

// ZKTeco devices hit /iclock/getrequest to ask the server if there are any commands pending for the device.
export async function GET(req: Request) {
  // Return "OK" to tell the device there are no commands to execute.
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
