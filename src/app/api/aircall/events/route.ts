import { getActorFromRequest } from "@/lib/server-permissions";
import { getAircallActiveCall, subscribeAircallState } from "@/lib/aircall-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (call: ReturnType<typeof getAircallActiveCall>) => {
        if (closed) return;
        const payload = JSON.stringify({ call });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      send(getAircallActiveCall());
      const unsubscribe = subscribeAircallState((call) => send(call));

      const keepAlive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      };

      req.signal.addEventListener("abort", stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
