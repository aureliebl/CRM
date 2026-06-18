import { NextResponse } from "next/server";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { getGroupIdForAccount, getGroupRouteVisibility } from "@/lib/security-store";

export const dynamic = "force-dynamic";

function normalizeFeatureKey(req: Request): string {
  const url = new URL(req.url);
  return String(url.searchParams.get("featureKey") || "").trim();
}

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const featureKey = normalizeFeatureKey(req);
  if (!featureKey) {
    return NextResponse.json({ error: "featureKey is required" }, { status: 400 });
  }

  // Admins and super admins always have full access.
  if (isAccountSuperAdmin(actor) || actor.role === "admin") {
    return NextResponse.json({
      featureKey,
      allowed: true,
      configured: false,
      source: "admin",
    });
  }

  const groupId = await getGroupIdForAccount(actor.id);
  if (!groupId) {
    return NextResponse.json({
      featureKey,
      allowed: true,
      configured: false,
      source: "default",
    });
  }

  const groupPermissions = await getGroupRouteVisibility(groupId);
  if (!groupPermissions.configured) {
    return NextResponse.json({
      featureKey,
      allowed: true,
      configured: false,
      source: "default",
    });
  }

  return NextResponse.json({
    featureKey,
    allowed: groupPermissions.routeKeys.includes(featureKey),
    configured: true,
    source: "group",
  });
}
