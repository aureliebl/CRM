import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import {
  getActorFromRequest,
  getActorIdFromRequest,
  isAccountSuperAdmin,
  isActorSuperAdmin,
} from "@/lib/server-permissions";
import { createTab, getAllTabs, getGroupIdsForTab, getTabsForGroup } from "@/lib/tabs-store";
import { getGroupIdForAccount } from "@/lib/security-store";
import { clearMemoryCacheByPrefix, getOrSetMemoryCache } from "@/lib/server-memory-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = actor.id;

  const superAdminMode = isAccountSuperAdmin(actor);
  if (superAdminMode) {
    const tabs = await getOrSetMemoryCache(`tabs:super-admin:${actorId}`, 3000, async () => {
      const allTabs = await getAllTabs();
      return Promise.all(
        allTabs.map(async (tab) => ({
          ...tab,
          groupIds: await getGroupIdsForTab(tab.id),
        }))
      );
    });
    return NextResponse.json(tabs);
  }

  if (actor.role === "admin") {
    const tabs = await getOrSetMemoryCache(`tabs:admin:${actorId}`, 3000, async () => {
      const visibleTabs = (await getAllTabs()).filter((tab) => tab.enabled && !tab.superAdminOnly);
      return Promise.all(
        visibleTabs.map(async (tab) => ({
          ...tab,
          groupIds: await getGroupIdsForTab(tab.id),
        }))
      );
    });
    return NextResponse.json(tabs);
  }

  const groupId = await getGroupIdForAccount(actorId);
  if (!groupId) return NextResponse.json([]);

  const tabs = await getOrSetMemoryCache(`tabs:group:${groupId}`, 3000, async () => {
    const groupTabs = await getTabsForGroup(groupId);
    return Promise.all(
      groupTabs.map(async (tab) => ({
        ...tab,
        groupIds: await getGroupIdsForTab(tab.id),
      }))
    );
  });
  return NextResponse.json(tabs);
}

export async function POST(req: Request) {
  if (!(await isActorSuperAdmin(req))) {
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
    superAdminOnly: body.superAdminOnly === true,
    config: body.config,
    groupIds: Array.isArray(body.groupIds) ? body.groupIds : [],
  });

  if (created) {
    clearMemoryCacheByPrefix("tabs:");
    await addLog(actorId, "tab.created", `Tab ${created.id} created by ${actorId}`);
  }

  return NextResponse.json(created, { status: 201 });
}
