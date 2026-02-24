import { NextResponse } from "next/server";
import { getAllAccounts } from "@/lib/account-store";
import {
  getAccountGroupMemberships,
  getIpAllowlistEntries,
  getSecuritySettings,
  getUserGroups,
} from "@/lib/security-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    accounts: getAllAccounts(),
    groups: getUserGroups(),
    memberships: getAccountGroupMemberships(),
    settings: getSecuritySettings(),
    ipAllowlist: getIpAllowlistEntries(),
  });
}
