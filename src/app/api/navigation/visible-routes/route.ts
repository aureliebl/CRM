import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount, getGroupRouteVisibility, getRoleRouteVisibility } from "@/lib/security-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Super admins always see all tabs
  if (isAccountSuperAdmin(actor)) {
    return NextResponse.json({ configured: false, routeKeys: [] });
  }

  const groupId = await getGroupIdForAccount(actor.id);
  const groupVisibility = groupId
    ? await getGroupRouteVisibility(groupId)
    : { configured: false, routeKeys: [] as string[] };

  const roleVisibility = actor.role
    ? await getRoleRouteVisibility(actor.role)
    : { configured: false, routeKeys: [] as string[] };

  // If neither is configured, show everything
  if (!groupVisibility.configured && !roleVisibility.configured) {
    return NextResponse.json({ configured: false, routeKeys: [] });
  }

  // If only one is configured, use that one
  if (groupVisibility.configured && !roleVisibility.configured) {
    return NextResponse.json(groupVisibility);
  }
  if (!groupVisibility.configured && roleVisibility.configured) {
    return NextResponse.json(roleVisibility);
  }

  // Both are configured: use intersection (most restrictive)
  const roleSet = new Set(roleVisibility.routeKeys);
  const intersected = groupVisibility.routeKeys.filter((key) => roleSet.has(key));
  return NextResponse.json({ configured: true, routeKeys: intersected });
}
