import { emitter, type SSEEvent } from "~/lib/events.server";

export async function loader() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode("data: {\"type\":\"connected\"}\n\n"));

      // Subscribe to events
      const unsubscribe = emitter.subscribe((event: SSEEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error("SSE encode error:", error);
        }
      });

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // Connection closed
          clearInterval(pingInterval);
        }
      }, 30000);

      // Cleanup on close
      return () => {
        unsubscribe();
        clearInterval(pingInterval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// API-only route
export default function Events() {
  return null;
}
