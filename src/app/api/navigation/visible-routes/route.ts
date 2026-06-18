import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount, getGroupRouteVisibility } from "@/lib/security-store";
import { isRoutePermissionKey } from "@/lib/feature-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admins and super admins always have full access.
  if (isAccountSuperAdmin(actor) || actor.role === "admin") {
    return NextResponse.json({ configured: false, routeKeys: [] });
  }

  const groupId = await getGroupIdForAccount(actor.id);
  const groupVisibility = groupId
    ? await getGroupRouteVisibility(groupId)
    : { configured: false, routeKeys: [] as string[] };

  // If no explicit group permission config exists, keep all routes visible.
  if (!groupVisibility.configured) {
    return NextResponse.json({ configured: false, routeKeys: [] });
  }

  // Navigation only consumes route-like permissions.
  return NextResponse.json({
    configured: true,
    routeKeys: groupVisibility.routeKeys.filter((key) => isRoutePermissionKey(key)),
  });
}
