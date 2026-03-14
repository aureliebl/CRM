import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { ensureDefaultBoard, getCards, createCard, getCommentCountsByBoardId } from "@/lib/tickets-store";
import { getAllAccounts } from "@/lib/account-store";

export const dynamic = "force-dynamic";

/* GET /api/tickets — list cards for the default board */
export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await ensureDefaultBoard();
  const [cards, commentCounts] = await Promise.all([
    getCards(board.id),
    getCommentCountsByBoardId(board.id),
  ]);
  const users = (await getAllAccounts()).map((account) => ({
    id: account.id,
    firstName: account.firstName ?? null,
    fullName: account.fullName,
    profileImage: account.profileImage ?? null,
    isActive: Number(account.isActive) === 1,
  }));

  return NextResponse.json({ board, cards, users, commentCounts });
}

/* POST /api/tickets — create a card (any authenticated user) */
export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, variables, columnKey, assigneeId, followerIds } = body;

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
    assigneeId: assigneeId || null,
    followerIds: Array.isArray(followerIds) ? followerIds : [],
    source: "manual",
    createdBy: actor.id,
  });

  return NextResponse.json(card, { status: 201 });
}
