import { NextResponse } from "next/server";
import { getAccountById, updateAccount } from "@/lib/account-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.role !== "admin" && body.role !== "operator") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await getAccountById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await updateAccount(id, { role: body.role });
  return NextResponse.json(updated);
}
