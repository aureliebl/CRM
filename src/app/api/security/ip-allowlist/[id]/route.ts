import { NextResponse } from "next/server";
import { deleteIpAllowlistEntry, updateIpAllowlistEntry } from "@/lib/security-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const updated = await updateIpAllowlistEntry(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await deleteIpAllowlistEntry(id);
  return NextResponse.json({ ok: true });
}
