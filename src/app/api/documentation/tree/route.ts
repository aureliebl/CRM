import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  getAccessibleDocumentationTree,
  listAccessibleDocumentationPages,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });

  const [tree, pages] = await Promise.all([
    getAccessibleDocumentationTree(scope),
    listAccessibleDocumentationPages(scope),
  ]);

  return NextResponse.json({ tree, pages });
}
