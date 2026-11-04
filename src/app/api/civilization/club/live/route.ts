import { getSessionUser } from "@/server/auth/session";
import { clubLiveActivityMarker } from "@/server/services/district-club-alert-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// K4.5: SSE transport is a bounded database-backed invalidation stream.
// It is not a WebSocket server or a scalable distributed push broker.
// The client retrieves actual content via authenticated, membership-checked GETs.
const POLL_MS = 2500;
const LIFETIME_MS = 22000;
const encoder = new TextEncoder();

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", {
    status: 401, headers: { "Cache-Control": "no-store" },
  });
  let closeStream: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let busy = false;
      let previous: string | null = null;
      const write = (value: string) => { if (!closed) controller.enqueue(encoder.encode(value)); };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearTimeout(deadline);
        request.signal.removeEventListener("abort", close);
        try { controller.close(); } catch { /* already closed */ }
      };
      closeStream = close;
      const poll = async () => {
        if (busy || closed) return;
        busy = true;
        try {
          const next = await clubLiveActivityMarker(user.id);
          if (closed) return;
          if (next !== previous) {
            previous = next;
            write("event: sync\ndata: {}\n\n");
          }
        } catch {
          // Including residence revocation and active bans: fail closed.
          close();
        } finally { busy = false; }
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
    status: 200, headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
