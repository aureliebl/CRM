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
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    accounts: await getAllAccounts(),
    groups: await getUserGroups(),
    memberships: await getAccountGroupMemberships(),
    settings: await getSecuritySettings(),
    ipAllowlist: await getIpAllowlistEntries(),
  });
}
