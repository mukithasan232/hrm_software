import { NextRequest } from 'next/server';
import { eventEmitter } from '@/lib/eventEmitter';

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const onNewNotification = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Listen for the event broadcast from controllers
      eventEmitter.on('new-notification', onNewNotification);

      // Keep connection alive with occasional pings
      const keepAliveInterval = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 30000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        eventEmitter.off('new-notification', onNewNotification);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
