import { NextResponse } from "next/server";
import {
  getAcquisitionBoardState,
  setAcquisitionBoardState,
  type AcquisitionBoardState,
} from "@/lib/acquisition-board-store";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

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

  const canManageScoringRules =
    actor.role === "admin" || isAccountSuperAdmin(actor);

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
