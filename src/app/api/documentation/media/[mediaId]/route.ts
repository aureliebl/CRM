import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  getDocumentationMediaForActor,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mediaId } = await params;
  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });
  const media = await getDocumentationMediaForActor(scope, mediaId);

  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fileBuffer = await fs.readFile(media.storagePath).catch(() => null);
  if (!fileBuffer) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename=\"${media.fileName.replace(/\"/g, "")}\"`,
    },
  });
}
