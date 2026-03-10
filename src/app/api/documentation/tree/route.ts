import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  getAccessibleDocumentationTree,
  listAccessibleDocumentationPages,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

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

  const cacheKey = `docs:tree:${scope.id}:${scope.role}`;
  const payload = await getOrSetMemoryCache(cacheKey, 2000, async () => {
    const [tree, pages] = await Promise.all([
      getAccessibleDocumentationTree(scope),
      listAccessibleDocumentationPages(scope),
    ]);
    return { tree, pages };
  });

  return NextResponse.json(payload);
}
