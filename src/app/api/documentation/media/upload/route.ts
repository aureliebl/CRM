import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  createDocumentationMediaRecord,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return "";
}

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const nodeId = String(formData.get("nodeId") ?? "").trim();
  const file = formData.get("file");

  if (!nodeId || !(file instanceof File)) {
    return NextResponse.json({ error: "nodeId and file are required" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 400 });
  }

  const ext = extensionFromMime(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image extension" }, { status: 400 });
  }

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });

  const mediaId = `media_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const fileName = `${mediaId}${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const contentBytes = Buffer.from(arrayBuffer);

  const record = await createDocumentationMediaRecord(scope, {
    nodeId,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath: "",
    contentBytes,
  });

  if (!record) {
    return NextResponse.json({ error: "Unable to attach image to page" }, { status: 400 });
  }

  try {
    await addLog(actor.id, "documentation.media.uploaded", `Media ${record.id} uploaded on node ${nodeId}`);
  } catch {
    // Ignore logging failures: upload already succeeded.
  }

  return NextResponse.json({
    id: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    src: `/api/documentation/media/${record.id}`,
  });
}
