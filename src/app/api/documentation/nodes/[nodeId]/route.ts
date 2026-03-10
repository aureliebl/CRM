import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  deleteDocumentationNode,
  getDocumentationNodeForActor,
  resolveDocumentationActorScope,
  updateDocumentationNode,
} from "@/lib/documentation-store";
import type { DocumentationBlock } from "@/lib/documentation-types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = await params;
  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });
  const node = await getDocumentationNodeForActor(scope, nodeId);

  if (!node) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(node);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        subtitle?: string;
        coverMediaId?: string | null;
        isPublic?: boolean;
        isPrivate?: boolean;
        folderVisibility?: "public" | "group";
        groupId?: string | null;
        content?: DocumentationBlock[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });
  const updated = await updateDocumentationNode(scope, nodeId, {
    title: body.title,
    subtitle: body.subtitle,
    coverMediaId: body.coverMediaId,
    isPublic: body.isPublic,
    isPrivate: body.isPrivate,
    folderVisibility: body.folderVisibility,
    groupId: body.groupId,
    content: body.content,
  });

  if (!updated) {
    return NextResponse.json({ error: "Unable to update node" }, { status: 400 });
  }

  await addLog(actor.id, "documentation.node.updated", `Node ${updated.id} updated`);
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = await params;
  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });
  const deleted = await deleteDocumentationNode(scope, nodeId);

  if (!deleted) {
    return NextResponse.json({ error: "Unable to delete node" }, { status: 400 });
  }

  await addLog(actor.id, "documentation.node.deleted", `Node ${nodeId} deleted`);
  return NextResponse.json({ deleted: true });
}
