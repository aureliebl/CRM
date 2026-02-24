import { NextResponse } from "next/server";
import { deleteTab, getGroupIdsForTab, getTabById, updateTab } from "@/lib/tabs-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tab = getTabById(id);
  if (!tab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...tab, groupIds: getGroupIdsForTab(id) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const updated = updateTab(id, {
    slug: body.slug,
    title: body.title,
    subtitle: body.subtitle,
    icon: body.icon,
    enabled: body.enabled,
    config: body.config,
    groupIds: Array.isArray(body.groupIds) ? body.groupIds : undefined,
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  deleteTab(id);
  return NextResponse.json({ ok: true });
}
