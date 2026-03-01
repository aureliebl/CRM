import { NextResponse } from "next/server";
import { applyAircallWebhook } from "@/lib/aircall-store";
import { logAircallWebhookEvent } from "@/lib/aircall-event-log";
import { verifyAircallWebhookRequest } from "@/lib/aircall-provider";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return NextResponse.json({ received: false, ignored: true, reason: "empty-payload" });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ received: false, ignored: true, reason: "invalid-json" });
  }

  if (!verifyAircallWebhookRequest(req, rawBody, payload)) {
    return NextResponse.json({ received: false, ignored: true, reason: "verification-failed" });
  }

  if (!payload) {
    return NextResponse.json({ received: false, ignored: true, reason: "missing-payload" });
  }

  const eventLog = logAircallWebhookEvent(payload);

  const root = payload as Record<string, unknown>;
  const resource = typeof root.resource === "string" ? root.resource : "";

  const call = resource === "call" ? applyAircallWebhook(payload) : null;
  return NextResponse.json({ received: true, resource: resource || "unknown", eventId: eventLog.id, call });
}
