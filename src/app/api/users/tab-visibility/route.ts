import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import {
  getUserGroups,
  getGroupRouteVisibility,
  setGroupRouteVisibility,
  getRoleRouteVisibility,
  setRoleRouteVisibility,
} from "@/lib/security-store";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["admin", "operator"];

function normalizeGroupIdFromRequest(req: Request, body?: Record<string, unknown>): string {
  const url = new URL(req.url);
  const queryGroupId = (url.searchParams.get("groupId") || "").trim();
  const bodyGroupId = String(body?.groupId || "").trim();
  return queryGroupId || bodyGroupId;
}

function normalizeRoleFromRequest(req: Request, body?: Record<string, unknown>): string {
  const url = new URL(req.url);
  const queryRole = (url.searchParams.get("role") || "").trim();
  const bodyRole = String(body?.role || "").trim();
  return queryRole || bodyRole;
}

function canActorConfigureRole(actorIsSuperAdmin: boolean, targetRole: string): boolean {
  // Only super admins can configure the "admin" role
  if (targetRole === "admin" && !actorIsSuperAdmin) return false;
  // Regular admins can configure "operator" role
  return true;
}

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = normalizeRoleFromRequest(req);
  const groupId = normalizeGroupIdFromRequest(req);

  // Role-based visibility
  if (role) {
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const actorIsSuperAdmin = isAccountSuperAdmin(actor);
    if (!canActorConfigureRole(actorIsSuperAdmin, role)) {
      return NextResponse.json({ error: "Only super admins can configure admin role visibility" }, { status: 403 });
    }

    const payload = await getRoleRouteVisibility(role);
    return NextResponse.json(payload);
  }

  // Group-based visibility (existing logic)
  if (!groupId) {
    return NextResponse.json({ error: "groupId or role is required" }, { status: 400 });
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
  const role = normalizeRoleFromRequest(req, body);
  const groupId = normalizeGroupIdFromRequest(req, body);

  const routeKeys = Array.isArray(body.routeKeys) ? body.routeKeys : null;
  if (!routeKeys) {
    return NextResponse.json({ error: "routeKeys must be an array" }, { status: 400 });
  }

  const normalizedRouteKeys = routeKeys.map((value) => String(value || "").trim()).filter(Boolean);

  // Role-based visibility
  if (role) {
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const actorIsSuperAdmin = isAccountSuperAdmin(actor);
    if (!canActorConfigureRole(actorIsSuperAdmin, role)) {
      return NextResponse.json({ error: "Only super admins can configure admin role visibility" }, { status: 403 });
    }

    const updated = await setRoleRouteVisibility(role, normalizedRouteKeys);
    return NextResponse.json(updated);
  }

  // Group-based visibility (existing logic)
  if (!groupId) {
    return NextResponse.json({ error: "groupId or role is required" }, { status: 400 });
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

  const updated = await setGroupRouteVisibility(groupId, normalizedRouteKeys);
  return NextResponse.json(updated);
}
