import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { deleteTab, getGroupIdsForTab, getTabById, updateTab } from "@/lib/tabs-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { getExpectedUpdatedAt, isStaleWrite } from "@/lib/optimistic-concurrency";
import { clearMemoryCacheByPrefix } from "@/lib/server-memory-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tab = await getTabById(id);
  if (!tab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...tab, groupIds: await getGroupIdsForTab(id) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;
  const body = await req.json();
  const existing = await getTabById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expectedUpdatedAt = getExpectedUpdatedAt(req, body);
  if (isStaleWrite(expectedUpdatedAt, existing.updatedAt ?? null)) {
    return NextResponse.json({ error: "Conflict: resource has been modified", code: "CONFLICT" }, { status: 409 });
  }

  const updated = await updateTab(id, {
    slug: body.slug,
    title: body.title,
    subtitle: body.subtitle,
    icon: body.icon,
    enabled: body.enabled,
    config: body.config,
    groupIds: Array.isArray(body.groupIds) ? body.groupIds : undefined,
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearMemoryCacheByPrefix("tabs:");
  if (actorId) {
    await addLog(actorId, "tab.updated", `Tab ${id} updated by ${actorId}`);
  }
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const { id } = await params;
  await deleteTab(id);
  clearMemoryCacheByPrefix("tabs:");
  if (actorId) {
    await addLog(actorId, "tab.deleted", `Tab ${id} deleted by ${actorId}`);
  }
  return NextResponse.json({ ok: true });
}
