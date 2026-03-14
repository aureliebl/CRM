import { NextResponse } from "next/server";
import {
  getActorFromRequest,
  isAccountSuperAdmin,
} from "@/lib/server-permissions";
import { canActorAccessEntry, getBackupCodes, getVaultEntryById, isActorEntryCreator } from "@/lib/vault-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; totpId: string }> };

/* GET /api/vault/:id/totp/:totpId/backup-codes — admin+ */
export async function GET(req: Request, context: Ctx) {
  const { id, totpId } = await context.params;
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

  if (!entry.canViewPassword) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    const isCreator = await isActorEntryCreator(actor, id);
    if (!isCreator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const codes = await getBackupCodes(totpId);
  return NextResponse.json(codes);
}
