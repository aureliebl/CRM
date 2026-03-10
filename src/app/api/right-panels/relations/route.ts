import { NextResponse } from "next/server";
import { resolveRightPanelRelation } from "@/lib/right-panel-relations";
import { getActorIdFromRequest } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const resolver = String(url.searchParams.get("resolver") || "").trim();
  const id = String(url.searchParams.get("id") || "").trim();

  if (!resolver) {
    return NextResponse.json({ error: "resolver is required" }, { status: 400 });
  }

  try {
    const data = await resolveRightPanelRelation(resolver, { id });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Unknown relation resolver" }, { status: 400 });
  }
}
