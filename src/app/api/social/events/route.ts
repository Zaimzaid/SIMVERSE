import { getSessionUser } from "@/server/auth/session";
import { socialActivityMarker } from "@/server/services/social-live-service";

// SSE pilot: database-backed change signals, no chat content on the stream.
// EventSource automatically reconnects; ordinary authenticated GETs retrieve
// the actual messages and re-check friendship/group permissions.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2000;
const LIFETIME_MS = 25000;
const encoder = new TextEncoder();

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401, headers: { "Cache-Control": "no-store" } });

  let closeStream: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let busy = false;
      let lastMarker: string | null = null;
      const write = (message: string) => {
        if (!closed) controller.enqueue(encoder.encode(message));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearTimeout(deadline);
        request.signal.removeEventListener("abort", close);
        try { controller.close(); } catch { /* already cancelled */ }
      };
      closeStream = close;
      const poll = async () => {
        if (closed || busy) return;
        busy = true;
        try {
          const marker = await socialActivityMarker(user.id);
          if (closed) return;
          if (marker !== lastMarker) {
            lastMarker = marker;
            // Clients use this only as an invalidation signal. No user data.
            write("event: sync\\ndata: {}\\n\\n".replaceAll("\\n", "\n"));
          }
        } catch {
          // A broken DB connection must close rather than emit stale events.
          close();
        } finally {
          busy = false;
        }
      };
      const interval = setInterval(() => void poll(), POLL_MS);
      const deadline = setTimeout(close, LIFETIME_MS);
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) { close(); return; }
      write("retry: 3000\n: connected\n\n");
      void poll();
    },
    cancel() { closeStream?.(); },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
