import { NextResponse } from "next/server";
import { addLog, deleteAccount, getAccountById, toSafeAccount, updateAccount } from "@/lib/account-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { getExpectedUpdatedAt, isStaleWrite } from "@/lib/optimistic-concurrency";
import { clearMemoryCacheByPrefix, getOrSetMemoryCache } from "@/lib/server-memory-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const { id } = resolved;
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminMode = await isActorAdmin(req);
  if (!adminMode && actorId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const a = await getOrSetMemoryCache(`accounts:item:${id}`, 3000, async () => {
    return getAccountById(id);
  });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toSafeAccount(a));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const { id } = resolved;
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminMode = await isActorAdmin(req);
  if (!adminMode && actorId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const existing = await getAccountById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expectedUpdatedAt = getExpectedUpdatedAt(req, body);
  if (isStaleWrite(expectedUpdatedAt, existing.updatedAt ?? null)) {
    return NextResponse.json({ error: "Conflict: resource has been modified", code: "CONFLICT" }, { status: 409 });
  }

  const patch = { ...(body ?? {}) };

  if (!adminMode) {
    delete patch.id;
    delete patch.role;
    delete patch.isActive;
    delete patch.totpEnabled;
    delete patch.totpSecret;
    delete patch.extras;
    delete patch.createdAt;
    delete patch.updatedAt;
  }

  const updated = await updateAccount(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearMemoryCacheByPrefix("accounts:");

  await addLog(actorId, "account.updated", `Account ${id} updated by ${actorId}`);

  return NextResponse.json(toSafeAccount(updated));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = await params;
  const { id } = resolved;

  const actorId = await getActorIdFromRequest(req);
  if (actorId && actorId === id) {
    return NextResponse.json({ error: "Cannot delete current actor" }, { status: 400 });
  }

  await deleteAccount(id);
  clearMemoryCacheByPrefix("accounts:");
  if (actorId) {
    await addLog(actorId, "account.deleted", `Account ${id} deleted by ${actorId}`);
  }
  return NextResponse.json({ ok: true });
}
