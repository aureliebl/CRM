import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getCardById, updateCard, deleteCard } from "@/lib/tickets-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/* GET /api/tickets/:id */
export async function GET(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const card = await getCardById(id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(card);
}

/* PATCH /api/tickets/:id — update (any authenticated user) */
export async function PATCH(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await updateCard(id, {
    title: body.title,
    description: body.description,
    variables: body.variables,
    columnKey: body.columnKey,
    position: body.position,
    assigneeId: body.assigneeId,
    followerIds: body.followerIds,
  });

  const updated = await getCardById(id);
  return NextResponse.json(updated);
}

/* DELETE /api/tickets/:id — delete (any authenticated user) */
export async function DELETE(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteCard(id);
  return NextResponse.json({ ok: true });
}
