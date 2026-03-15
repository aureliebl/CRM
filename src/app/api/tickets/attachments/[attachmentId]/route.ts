import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getAttachmentBinary, deleteAttachment } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ attachmentId: string }> };

/* GET /api/tickets/attachments/:attachmentId — serve image binary */
export async function GET(req: Request, context: Ctx) {
  const { attachmentId } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getAttachmentBinary(attachmentId);
  if (!result || !result.contentBytes || result.contentBytes.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { attachment, contentBytes } = result;

  return new Response(new Uint8Array(contentBytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${attachment.fileName.replace(/"/g, "")}"`,
    },
  });
}

/* DELETE /api/tickets/attachments/:attachmentId — delete attachment */
export async function DELETE(req: Request, context: Ctx) {
  const { attachmentId } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteAttachment(attachmentId);
  return NextResponse.json({ ok: true });
}
