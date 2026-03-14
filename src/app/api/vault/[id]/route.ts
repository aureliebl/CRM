import { NextResponse } from "next/server";
import {
  getActorFromRequest,
  isAccountSuperAdmin,
} from "@/lib/server-permissions";
import {
  getVaultEntryById,
  updateVaultEntry,
  deleteVaultEntry,
  canActorAccessEntry,
} from "@/lib/vault-store";
import { addLog } from "@/lib/account-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/* GET /api/vault/:id — detail (decrypted) */
export async function GET(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = await canActorAccessEntry(actor, id);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await getVaultEntryById(id, actor);
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await addLog(actor.id, "vault_access", `Accessed vault entry "${entry.serviceName}"`);

  return NextResponse.json(entry);
}

/* PUT /api/vault/:id — update (admin+) */
export async function PUT(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { serviceName, serviceUrl, login, password, notes, groupIds, adminOnly, passwordOwnerOnly } = body;

  await updateVaultEntry(id, {
    serviceName,
    serviceUrl,
    login,
    password,
    notes,
    groupIds,
    adminOnly,
    passwordOwnerOnly,
  });

  await addLog(actor.id, "vault_update", `Updated vault entry ${id}`);

  const updated = await getVaultEntryById(id, actor);
  return NextResponse.json(updated);
}

/* DELETE /api/vault/:id — delete (super admin only) */
export async function DELETE(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor || !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteVaultEntry(id);
  await addLog(actor.id, "vault_delete", `Deleted vault entry ${id}`);

  return NextResponse.json({ ok: true });
}
