import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { ensureDefaultBoard, createApiToken, getApiTokens } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

/* GET /api/tickets/tokens — list tokens (super admin) */
export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await ensureDefaultBoard();
  const tokens = await getApiTokens(board.id);
  return NextResponse.json(tokens);
}

/* POST /api/tickets/tokens — create token (super admin) */
export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { label } = body;

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const board = await ensureDefaultBoard();
  const result = await createApiToken(board.id, label, actor.id);

  return NextResponse.json(result, { status: 201 });
}
