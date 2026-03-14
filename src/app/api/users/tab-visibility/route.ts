import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getUserGroups, getGroupRouteVisibility, setGroupRouteVisibility } from "@/lib/security-store";

export const dynamic = "force-dynamic";

function normalizeGroupIdFromRequest(req: Request, body?: Record<string, unknown>): string {
  const url = new URL(req.url);
  const queryGroupId = (url.searchParams.get("groupId") || "").trim();
  const bodyGroupId = String(body?.groupId || "").trim();
  return queryGroupId || bodyGroupId;
}

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groupId = normalizeGroupIdFromRequest(req);
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  const groups = await getUserGroups();
  const targetGroup = groups.find((group) => group.id === groupId);
  if (!targetGroup) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const actorIsSuperAdmin = isAccountSuperAdmin(actor);
  if (!actorIsSuperAdmin && targetGroup.isAdmin) {
    return NextResponse.json({ error: "Only super admins can configure admin groups" }, { status: 403 });
  }

  const payload = await getGroupRouteVisibility(groupId);
  return NextResponse.json(payload);
}

export async function PUT(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const groupId = normalizeGroupIdFromRequest(req, body);
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  const routeKeys = Array.isArray(body.routeKeys) ? body.routeKeys : null;
  if (!routeKeys) {
    return NextResponse.json({ error: "routeKeys must be an array" }, { status: 400 });
  }

  const groups = await getUserGroups();
  const targetGroup = groups.find((group) => group.id === groupId);
  if (!targetGroup) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const actorIsSuperAdmin = isAccountSuperAdmin(actor);
  if (!actorIsSuperAdmin && targetGroup.isAdmin) {
    return NextResponse.json({ error: "Only super admins can configure admin groups" }, { status: 403 });
  }

  const updated = await setGroupRouteVisibility(
    groupId,
    routeKeys.map((value) => String(value || "").trim()).filter(Boolean)
  );

  return NextResponse.json(updated);
}
