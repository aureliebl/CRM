import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getCardById, createComment, getCommentsByCardId } from "@/lib/tickets-store";
import { getAccountById } from "@/lib/account-store";
import { sendTicketCommentEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/* GET /api/tickets/:id/comments — list comments for a card */
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

  const comments = await getCommentsByCardId(id);
  return NextResponse.json(comments);
}

/* POST /api/tickets/:id/comments — add a comment */
export async function POST(req: Request, context: Ctx) {
  const { id } = await context.params;
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const card = await getCardById(id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const comment = await createComment({ cardId: id, authorId: actor.id, body: text });

  // Send email notification asynchronously (fire-and-forget)
  const authorAccount = await getAccountById(actor.id);
  const authorName = authorAccount?.firstName || authorAccount?.fullName || actor.fullName || "Quelqu'un";

  // Collect recipient IDs: creator + followers (excluding the comment author)
  const recipientIds = new Set<string>();
  if (card.createdBy && card.createdBy !== actor.id) recipientIds.add(card.createdBy);
  for (const fid of card.followerIds) {
    if (fid !== actor.id) recipientIds.add(fid);
  }

  // Send emails in the background
  if (recipientIds.size > 0) {
    (async () => {
      for (const uid of recipientIds) {
        try {
          const account = await getAccountById(uid);
          if (account?.email) {
            await sendTicketCommentEmail({
              to: account.email,
              ticketTitle: card.title,
              commentBody: text,
              authorName,
            });
          }
        } catch (e) {
          console.error("[ticket-comment-email] failed for", uid, e);
        }
      }
    })();
  }

  return NextResponse.json(comment, { status: 201 });
}
