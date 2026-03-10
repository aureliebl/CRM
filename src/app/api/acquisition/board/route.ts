import { NextResponse } from "next/server";
import {
  getAcquisitionBoardState,
  setAcquisitionBoardState,
  type AcquisitionBoardState,
} from "@/lib/acquisition-board-store";
import { getActorIdFromRequest } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getAcquisitionBoardState();
  return NextResponse.json(state);
}

export async function PUT(req: Request) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as AcquisitionBoardState | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const saved = await setAcquisitionBoardState(body);
  return NextResponse.json(saved);
}
