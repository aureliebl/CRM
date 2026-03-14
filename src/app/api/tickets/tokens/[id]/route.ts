import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { deactivateApiToken } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/* DELETE /api/tickets/tokens/:id — deactivate (super admin) */
export async function DELETE(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor || !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deactivateApiToken(id);
  return NextResponse.json({ ok: true });
}
