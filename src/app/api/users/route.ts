import { NextResponse } from "next/server";
import { getAllAccounts } from "@/lib/account-store";
import { getAccountGroupMemberships, getUserGroups } from "@/lib/security-store";
import { getActorFromRequest } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [accounts, memberships, groups] = await Promise.all([
    getAllAccounts(),
    getAccountGroupMemberships(),
    getUserGroups(),
  ]);

  const membershipMap = new Map(memberships.map((m) => [m.accountId, m.groupId]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const users = accounts.map((a) => {
    const groupId = membershipMap.get(a.id);
    const group = groupId ? groupMap.get(groupId) : undefined;
    return {
      id: a.id,
      email: a.email,
      fullName: a.fullName,
      firstName: a.firstName,
      lastName: a.lastName,
      role: a.role,
      isActive: a.isActive,
      profileImage: a.profileImage,
      groupId: groupId ?? null,
      groupName: group?.name ?? null,
      createdAt: a.createdAt,
    };
  });

  return NextResponse.json(users);
}
