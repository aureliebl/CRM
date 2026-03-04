import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  getDocumentationNodeAccessForActor,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";
import { createDocumentationCrdtToken } from "@/lib/documentation-crdt-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { nodeId?: string } | null;
  const nodeId = String(body?.nodeId ?? "").trim();
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });

  const access = await getDocumentationNodeAccessForActor(scope, nodeId);
  if (!access?.canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorName = actor.fullName?.trim() || actor.email || actor.id;
  const token = createDocumentationCrdtToken({
    actorId: actor.id,
    actorName,
    role: scope.role,
    nodeId,
    canWrite: access.canWrite,
    expiresInSeconds: 60 * 10,
  });

  return NextResponse.json({
    token,
    room: nodeId,
    canWrite: access.canWrite,
    actor: {
      id: actor.id,
      name: actorName,
      role: scope.role,
    },
    wsUrl: process.env.NEXT_PUBLIC_DOCS_CRDT_WS_URL || "ws://localhost:1234",
  });
}
