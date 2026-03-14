import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { moveCard } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

/* POST /api/tickets/move — move a card to a column + position */
export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { cardId, columnKey, position } = body;

  if (!cardId || !columnKey || position === undefined) {
    return NextResponse.json({ error: "cardId, columnKey, and position are required" }, { status: 400 });
  }

  await moveCard(cardId, columnKey, Number(position));
  return NextResponse.json({ ok: true });
}
