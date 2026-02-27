import { NextResponse } from "next/server";
import { addLog, getAccountById, toSafeAccount, updateAccount } from "@/lib/account-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = getActorIdFromRequest(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nextIsActive = body?.isActive;

  if (typeof nextIsActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
  }

  if (actorId && actorId === id && nextIsActive === false) {
    return NextResponse.json({ error: "Cannot deactivate current actor" }, { status: 400 });
  }

  const existing = await getAccountById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await updateAccount(id, { isActive: nextIsActive ? 1 : 0 });
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }

  await addLog(
    updated.id,
    "account.activation_changed",
    `Account ${nextIsActive ? "activated" : "deactivated"} by ${actorId ?? "system"}`
  );

  return NextResponse.json(toSafeAccount(updated));
}
