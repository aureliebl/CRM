import { NextResponse } from "next/server";
import {
  getActorFromRequest,
  isAccountSuperAdmin,
} from "@/lib/server-permissions";
import { getBackupCodes } from "@/lib/vault-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; totpId: string }> };

/* GET /api/vault/:id/totp/:totpId/backup-codes — admin+ */
export async function GET(req: Request, context: Ctx) {
  const { totpId } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await getBackupCodes(totpId);
  return NextResponse.json(codes);
}
