import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
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

/* PATCH /api/tickets/:id — update (admin+) */
export async function PATCH(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

/* DELETE /api/tickets/:id — delete (admin+) */
export async function DELETE(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin" && !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteCard(id);
  return NextResponse.json({ ok: true });
}
