import { NextResponse } from "next/server";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount } from "@/lib/security-store";
import { getTabBySlug, getTabsForGroup } from "@/lib/tabs-store";
import { resolveDynamicTabRows } from "@/lib/dynamic-tab-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actorId = getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const tab = getTabBySlug(slug);
  if (!tab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isActorAdmin(req)) {
    const groupId = getGroupIdForAccount(actorId);
    if (!groupId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const allowed = getTabsForGroup(groupId).some((item) => item.id === tab.id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await resolveDynamicTabRows(tab.config);
  return NextResponse.json(rows);
}
