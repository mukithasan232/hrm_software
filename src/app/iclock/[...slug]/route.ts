export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  console.log(`\n🔥 [ZKTeco ADMS GET] HIT: ${req.url}`);
  console.log(`🔥 [ZKTeco ADMS GET] Search Params: ${url.search}`);
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const rawBody = await req.text();

    console.log(`\n🔥 [ZKTeco ADMS POST] HIT: ${req.url}`);
    console.log(`🔥 [ZKTeco ADMS POST] Search Params: ${url.search}`);
    console.log(`🔥 [ZKTeco ADMS POST] Raw Body:\n${rawBody}\n`);

    return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
  } catch (err: any) {
    console.error(`\n🔥 [ZKTeco ADMS POST] ERROR:`, err.message);
    return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}
