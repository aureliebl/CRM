import { NextResponse } from "next/server";
import {
  getActorFromRequest,
  isAccountSuperAdmin,
} from "@/lib/server-permissions";
import {
  getVaultEntriesForActor,
  createVaultEntry,
} from "@/lib/vault-store";
import { addLog } from "@/lib/account-store";

export const dynamic = "force-dynamic";

/* GET /api/vault — list vault entries (filtered by group) */
export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getVaultEntriesForActor(actor);
  return NextResponse.json(entries);
}

/* POST /api/vault — create a vault entry (admin+) */
export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { serviceName, serviceUrl, login, password, notes, groupIds, adminOnly, passwordOwnerOnly } = body;

  if (!serviceName || !login || !password) {
    return NextResponse.json(
      { error: "serviceName, login, and password are required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(groupIds)) {
    return NextResponse.json(
      { error: "groupIds must be an array" },
      { status: 400 }
    );
  }
  if (!Boolean(adminOnly) && groupIds.length === 0) {
    return NextResponse.json(
      { error: "At least one groupId is required" },
      { status: 400 }
    );
  }

  const entry = await createVaultEntry({
    serviceName,
    serviceUrl: serviceUrl || null,
    login,
    password,
    notes: notes || null,
    groupIds,
    adminOnly: Boolean(adminOnly),
    passwordOwnerOnly: Boolean(passwordOwnerOnly),
    createdBy: actor.id,
  });

  await addLog(actor.id, "vault_create", `Created vault entry "${serviceName}"`);

  return NextResponse.json(entry, { status: 201 });
}
