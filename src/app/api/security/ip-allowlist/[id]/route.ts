import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { deleteIpAllowlistEntry, updateIpAllowlistEntry } from "@/lib/security-store";
import { getActorIdFromRequest, isActorSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;
  const body = await req.json();
  const updated = await updateIpAllowlistEntry(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (actorId) {
    await addLog(actorId, "security.ip_allowlist.updated", `IP allowlist entry ${id} updated by ${actorId}`);
  }
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;
  await deleteIpAllowlistEntry(id);
  if (actorId) {
    await addLog(actorId, "security.ip_allowlist.deleted", `IP allowlist entry ${id} deleted by ${actorId}`);
  }
  return NextResponse.json({ ok: true });
}
