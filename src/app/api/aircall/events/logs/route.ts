import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getAircallWebhookEvents } from "@/lib/aircall-event-log";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 50;

  return NextResponse.json({
    events: getAircallWebhookEvents(limit),
  });
}
