import { NextRequest, NextResponse } from "next/server";
import { server } from "../../../../server"; // Adjust path if needed

export const dynamic = 'force-dynamic';

// A lightweight custom transport to bridge Next.js Web Streams with MCP
let globalWriter: WritableStreamDefaultWriter | null = null;

const nextJsTransport: any = {
  start: async () => {},
  close: async () => {
    if (globalWriter) {
      await globalWriter.close().catch(() => {});
      globalWriter = null;
    }
  },
  send: async (message: any) => {
    if (globalWriter) {
      const encoder = new TextEncoder();
      const data = `data: ${JSON.stringify(message)}\n\n`;
      await globalWriter.write(encoder.encode(data));
    }
  },
  onmessage: undefined,
  onclose: undefined,
  onerror: undefined
};

// Connect the transport to the server exactly once
server.connect(nextJsTransport).catch(console.error);

export async function GET(request: NextRequest) {
  const responseStream = new TransformStream();
  globalWriter = responseStream.writable.getWriter();

  console.log('[MCP] New SSE client connected via Next.js App Router.');

  request.signal.addEventListener('abort', () => {
    console.log('[MCP] SSE client disconnected.');
    if (globalWriter) {
      globalWriter.close().catch(() => {});
      globalWriter = null;
    }
  });

  return new NextResponse(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const message = await request.json();
    console.log('[MCP] Received message from client.');

    // Route the incoming JSON message to the server
    if (nextJsTransport.onmessage) {
      await nextJsTransport.onmessage(message);
    }

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error: any) {
    console.error("[MCP] Error processing POST request:", error);
    return NextResponse.json(
      { error: "Failed to process message.", details: error.message },
      { status: 500 }
    );
  }
}