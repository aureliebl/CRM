import { NextResponse } from "next/server";
import { getAllAccounts, getRecentLogs, toSafeAccount } from "@/lib/account-store";
import {
  getAccountGroupMemberships,
  getIpAllowlistEntries,
  getSecuritySettings,
  getUserGroups,
} from "@/lib/security-store";
import { isActorSuperAdmin } from "@/lib/server-permissions";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getOrSetMemoryCache("security:overview", 5000, async () => ({
    accounts: (await getAllAccounts()).map(toSafeAccount),
    groups: await getUserGroups(),
    memberships: await getAccountGroupMemberships(),
    settings: await getSecuritySettings(),
    ipAllowlist: await getIpAllowlistEntries(),
    logs: await getRecentLogs(40),
  }));

  return NextResponse.json(payload);
}
