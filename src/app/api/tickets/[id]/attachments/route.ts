import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getCardById, createAttachment, getAttachmentsByCardId } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

type Ctx = { params: Promise<{ id: string }> };

/* GET /api/tickets/:id/attachments — list attachments for a card */
export async function GET(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const card = await getCardById(id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachments = await getAttachmentsByCardId(id);
  const withSrc = attachments.map((a) => ({
    ...a,
    src: `/api/tickets/attachments/${a.id}`,
  }));
  return NextResponse.json(withSrc);
}

/* POST /api/tickets/:id/attachments — upload image attachment */
export async function POST(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const card = await getCardById(id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const commentId = formData.get("commentId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image format. Allowed: PNG, JPEG, WebP, GIF" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8 MB)" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const contentBytes = Buffer.from(arrayBuffer);

  const attachment = await createAttachment({
    cardId: id,
    commentId: commentId ? String(commentId) : null,
    uploaderId: actor.id,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    contentBytes,
  });

  return NextResponse.json({
    id: attachment.id,
    cardId: attachment.cardId,
    commentId: attachment.commentId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
    src: `/api/tickets/attachments/${attachment.id}`,
  }, { status: 201 });
}
