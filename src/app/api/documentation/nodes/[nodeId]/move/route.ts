import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import { moveDocumentationNode, resolveDocumentationActorScope } from "@/lib/documentation-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = await params;
  const body = (await req.json().catch(() => null)) as { parentId?: string | null } | null;
  const parentId = body?.parentId ?? null;

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });
  const moved = await moveDocumentationNode(scope, nodeId, parentId);

  if (!moved) {
    return NextResponse.json({ error: "Unable to move node" }, { status: 400 });
  }

  await addLog(actor.id, "documentation.node.moved", `Node ${nodeId} moved to ${parentId ?? "root"}`);
  return NextResponse.json(moved);
}
