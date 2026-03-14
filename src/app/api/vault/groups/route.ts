import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getUserGroups } from "@/lib/security-store";

export const dynamic = "force-dynamic";

/* GET /api/vault/groups — lightweight group list (id + name) for any authenticated user */
export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await getUserGroups();
  return NextResponse.json(
    groups.map((g) => ({ id: g.id, name: g.name }))
  );
}
