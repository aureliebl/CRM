import { NextResponse } from "next/server";
import { getAccountById, updateAccount, deleteAccount, createAccount } from "@/lib/account-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const { id } = resolved;
  const a = await getAccountById(id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(a);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const { id } = resolved;
  const body = await req.json();
  let updated = await updateAccount(id, body);
  if (!updated) {
    // If account doesn't exist yet, create it using provided id
    updated = await createAccount({ id, ...body });
    return NextResponse.json(updated, { status: 201 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const { id } = resolved;
  await deleteAccount(id);
  return NextResponse.json({ ok: true });
}
