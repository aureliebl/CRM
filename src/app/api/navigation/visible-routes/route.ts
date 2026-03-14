import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount, getGroupRouteVisibility } from "@/lib/security-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isAccountSuperAdmin(actor)) {
    return NextResponse.json({ configured: false, routeKeys: [] });
  }

  const groupId = await getGroupIdForAccount(actor.id);
  if (!groupId) {
    return NextResponse.json({ configured: false, routeKeys: [] });
  }

  const visibility = await getGroupRouteVisibility(groupId);
  return NextResponse.json(visibility);
}
