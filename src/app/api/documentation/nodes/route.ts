import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  createDocumentationNode,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        parentId?: string | null;
        kind?: "folder" | "page";
        title?: string;
        subtitle?: string;
        coverMediaId?: string | null;
        isPublic?: boolean;
        sharedGroupIds?: string[];
        sharedUserIds?: string[];
        folderVisibility?: "public" | "group";
        groupId?: string | null;
        isPrivate?: boolean;
      }
    | null;

  if (!body?.kind || !body?.title) {
    return NextResponse.json({ error: "kind and title are required" }, { status: 400 });
  }

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });

  const created = await createDocumentationNode(scope, {
    parentId: body.parentId ?? null,
    kind: body.kind,
    title: body.title,
    subtitle: body.subtitle,
    coverMediaId: body.coverMediaId,
    isPublic: body.isPublic,
    sharedGroupIds: body.sharedGroupIds,
    sharedUserIds: body.sharedUserIds,
    folderVisibility: body.folderVisibility,
    groupId: body.groupId,
    isPrivate: body.isPrivate,
  });

  if (!created) {
    return NextResponse.json({ error: "Unable to create node" }, { status: 400 });
  }

  await addLog(actor.id, "documentation.node.created", `Node ${created.id} created (${created.kind})`);
  return NextResponse.json(created, { status: 201 });
}
