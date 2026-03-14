import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { ensureDefaultBoard, getCards, createCard } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

/* GET /api/tickets — list cards for the default board */
export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await ensureDefaultBoard();
  const cards = await getCards(board.id);

  return NextResponse.json({ board, cards });
}

/* POST /api/tickets — create a card (admin+) */
export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, variables, columnKey } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const board = await ensureDefaultBoard();
  const card = await createCard({
    boardId: board.id,
    title,
    description: description || null,
    variables: variables || [],
    columnKey: columnKey || "nouveau",
    source: "manual",
    createdBy: actor.id,
  });

  return NextResponse.json(card, { status: 201 });
}
