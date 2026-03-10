import { NextResponse } from "next/server";
import { getAllowedRelationResolvers, resolveRightPanelRelation } from "@/lib/right-panel-relations";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const resolver = String(url.searchParams.get("resolver") || "").trim();

  if (!resolver) {
    return NextResponse.json({ resolvers: getAllowedRelationResolvers() });
  }

  const id = String(url.searchParams.get("id") || "").trim();

  try {
    const data = await resolveRightPanelRelation(resolver, { id });
    return NextResponse.json({ resolver, data });
  } catch {
    return NextResponse.json({ error: "Unknown relation resolver" }, { status: 400 });
  }
}
