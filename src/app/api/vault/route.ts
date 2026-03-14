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
import { getGroupIdForAccount } from "@/lib/security-store";

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
  try {
    const actor = await getActorFromRequest(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actorIsAdmin = actor.role === "admin";
    const actorIsSuperAdmin = isAccountSuperAdmin(actor);
    const actorCanUseAdminOnly = actorIsAdmin || actorIsSuperAdmin;

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

    const adminOnlyFlag = actorCanUseAdminOnly ? Boolean(adminOnly) : false;
    let normalizedGroupIds = groupIds
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const actorGroupId = await getGroupIdForAccount(actor.id);

    if (!actorCanUseAdminOnly) {
      normalizedGroupIds = actorGroupId ? [actorGroupId] : [];
    }

    if (!adminOnlyFlag && normalizedGroupIds.length === 0) {
      if (actorGroupId) normalizedGroupIds = [actorGroupId];
    }

    if (!adminOnlyFlag && normalizedGroupIds.length === 0) {
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
      groupIds: normalizedGroupIds,
      adminOnly: adminOnlyFlag,
      passwordOwnerOnly: Boolean(passwordOwnerOnly),
      createdBy: actor.id,
    });

    await addLog(actor.id, "vault_create", `Created vault entry "${serviceName}"`);

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create vault entry" },
      { status: 500 }
    );
  }
}
