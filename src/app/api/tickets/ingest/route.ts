import { NextResponse } from "next/server";
import { validateApiToken, createCard } from "@/lib/tickets-store";
import { getAccountById } from "@/lib/account-store";

export const dynamic = "force-dynamic";

/* POST /api/tickets/ingest — external JSON ingestion via Bearer token
 *
 * Usage:
 *   curl -X POST https://your-app.com/api/tickets/ingest \
 *     -H "Authorization: Bearer <TOKEN>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"title":"Bug report","description":"<p>Details here</p>","variables":[{"key":"Priority","value":"High","type":"badge","color":"red"}],"createdBy":"<USER_ID>"}'
 */
export async function POST(req: Request) {
  // Validate Bearer token
  const authHeader = req.headers.get("authorization") || "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = raw.replace(/^<|>$/g, "");

  if (!token) {
    return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
  }

  const validity = await validateApiToken(token);
  if (!validity) {
    return NextResponse.json({ error: "Invalid or deactivated token" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, variables, column, createdBy } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Validate createdBy if provided — must reference an existing account
  let resolvedCreatedBy: string | null = null;
  if (createdBy && typeof createdBy === "string") {
    const account = await getAccountById(createdBy);
    if (account) {
      resolvedCreatedBy = account.id;
    }
  }

  const card = await createCard({
    boardId: validity.boardId,
    title,
    description: description || null,
    variables: Array.isArray(variables) ? variables : [],
    columnKey: column || "nouveau",
    source: "api",
    createdBy: resolvedCreatedBy,
  });

  return NextResponse.json(card, { status: 201 });
}
