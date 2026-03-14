import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount } from "@/lib/security-store";
import { getGroupIdsForTab, getTabBySlug, getTabsForGroup } from "@/lib/tabs-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = actor.id;
  const superAdminMode = isAccountSuperAdmin(actor);

  const { slug } = await params;
  const tab = await getTabBySlug(slug);
  if (!tab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tab.superAdminOnly && !superAdminMode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tab.enabled && !superAdminMode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (superAdminMode || actor.role === "admin") {
    return NextResponse.json({ ...tab, groupIds: await getGroupIdsForTab(tab.id) });
  }

  const groupId = await getGroupIdForAccount(actorId);
  if (!groupId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allowed = (await getTabsForGroup(groupId)).some((item) => item.id === tab.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ...tab, groupIds: await getGroupIdsForTab(tab.id) });
}
