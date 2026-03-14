import { NextResponse } from "next/server";
import { addLog, getAccountById, updateAccount } from "@/lib/account-store";
import { getActorIdFromRequest, isActorSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);

  const { id } = await params;
  const body = await req.json();

  if (body.role !== "admin" && body.role !== "operator") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await getAccountById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await updateAccount(id, { role: body.role });
  if (updated) {
    await addLog(updated.id, "account.role_changed", `Role changed to ${updated.role} by ${actorId ?? "system"}`);
  }
  return NextResponse.json(updated);
}
