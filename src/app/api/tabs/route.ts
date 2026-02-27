import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { isActorAdmin, getActorIdFromRequest } from "@/lib/server-permissions";
import { createTab, getAllTabs, getGroupIdsForTab, getTabsForGroup } from "@/lib/tabs-store";
import { getGroupIdForAccount } from "@/lib/security-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminMode = await isActorAdmin(req);
  if (adminMode) {
    const allTabs = await getAllTabs();
    const tabs = await Promise.all(allTabs.map(async (tab) => ({
      ...tab,
      groupIds: await getGroupIdsForTab(tab.id),
    })));
    return NextResponse.json(tabs);
  }

  const groupId = await getGroupIdForAccount(actorId);
  if (!groupId) return NextResponse.json([]);

  const groupTabs = await getTabsForGroup(groupId);
  const tabs = await Promise.all(groupTabs.map(async (tab) => ({
    ...tab,
    groupIds: await getGroupIdsForTab(tab.id),
  })));
  return NextResponse.json(tabs);
}

export async function POST(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.slug || !body.title) {
    return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
  }

  const created = await createTab({
    slug: body.slug,
    title: body.title,
    subtitle: body.subtitle,
    icon: body.icon,
    createdBy: actorId,
    config: body.config,
    groupIds: Array.isArray(body.groupIds) ? body.groupIds : [],
  });

  if (created) {
    await addLog(actorId, "tab.created", `Tab ${created.id} created by ${actorId}`);
  }

  return NextResponse.json(created, { status: 201 });
}
