import { NextResponse } from "next/server";
import { getMergedRightPanelConfig } from "@/lib/right-panel-config-service";
import { getActorIdFromRequest } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ panelId: string }> }) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { panelId } = await params;
  const config = await getMergedRightPanelConfig(panelId);
  if (!config) {
    return NextResponse.json({ error: "Unknown panel id" }, { status: 404 });
  }

  return NextResponse.json(config);
}
