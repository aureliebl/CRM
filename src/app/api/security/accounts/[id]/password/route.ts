import { NextResponse } from "next/server";
import { addLog, getAccountById, setAccountPassword } from "@/lib/account-store";
import { getActorIdFromRequest, isActorSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;

  if (actorId && actorId === id) {
    return NextResponse.json({ error: "Use profile settings to update your own password" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password ?? "");

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await getAccountById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await setAccountPassword(id, password);
  await addLog(id, "account.password_reset_admin", `Password reset by ${actorId ?? "system"}`);
  return NextResponse.json({ ok: true });
}
