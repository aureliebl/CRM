import { NextResponse } from "next/server";
import {
  getAcquisitionBoardState,
  setAcquisitionBoardState,
  type AcquisitionBoardState,
} from "@/lib/acquisition-board-store";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount, getGroupRouteVisibility } from "@/lib/security-store";
import { LEAD_PRIORITIZATION_FEATURE_KEY } from "@/lib/feature-permissions";

export const dynamic = "force-dynamic";

async function canActorManageLeadScoring(actor: { id: string; role?: string | null; email?: string | null }) {
  if (isAccountSuperAdmin(actor) || actor.role === "admin") {
    return true;
  }

  const groupId = await getGroupIdForAccount(actor.id);
  if (!groupId) {
    return true;
  }

  const permissions = await getGroupRouteVisibility(groupId);
  if (!permissions.configured) {
    return true;
  }

  return permissions.routeKeys.includes(LEAD_PRIORITIZATION_FEATURE_KEY);
}

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getAcquisitionBoardState();
  return NextResponse.json(state);
}

export async function PUT(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as AcquisitionBoardState | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const canManageScoringRules = await canActorManageLeadScoring(actor);

  let payloadToSave: AcquisitionBoardState = body;
  if (!canManageScoringRules) {
    const current = await getAcquisitionBoardState();
    payloadToSave = {
      ...body,
      scoring: current.scoring,
    };
  }

  const saved = await setAcquisitionBoardState(payloadToSave);
  return NextResponse.json(saved);
}
