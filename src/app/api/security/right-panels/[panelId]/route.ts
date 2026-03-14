import { NextResponse } from "next/server";
import { isRegisteredRightPanel } from "@/lib/right-panel-registry";
import { getMergedRightPanelConfig } from "@/lib/right-panel-config-service";
import { upsertRightPanelConfigOverride } from "@/lib/right-panel-config-store";
import { validateRightPanelConfigOverride } from "@/lib/right-panel-config-validation";
import { getActorIdFromRequest, isActorSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ panelId: string }> }) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { panelId } = await params;
  if (!isRegisteredRightPanel(panelId)) {
    return NextResponse.json({ error: "Unknown panel id" }, { status: 404 });
  }

  const config = await getMergedRightPanelConfig(panelId);
  if (!config) {
    return NextResponse.json({ error: "Unknown panel id" }, { status: 404 });
  }

  return NextResponse.json(config);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ panelId: string }> }) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { panelId } = await params;
  if (!isRegisteredRightPanel(panelId)) {
    return NextResponse.json({ error: "Unknown panel id" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const validation = validateRightPanelConfigOverride(panelId, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  await upsertRightPanelConfigOverride({
    panelId,
    override: validation.value,
    updatedBy: actorId,
  });

  const merged = await getMergedRightPanelConfig(panelId);
  return NextResponse.json(merged);
}
