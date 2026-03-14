import { NextResponse } from "next/server";
import { getAccountById, addLog } from "@/lib/account-store";
import {
  setAccountGroupMembership,
  getUserGroups,
} from "@/lib/security-store";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as { groupId?: string };
  const { groupId } = body;

  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  // Cannot modify own group
  if (id === actor.id) {
    return NextResponse.json(
      { error: "Cannot modify your own group" },
      { status: 400 }
    );
  }

  const targetAccount = await getAccountById(id);
  if (!targetAccount) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const groups = await getUserGroups();
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const targetGroup = groupMap.get(groupId);

  if (!targetGroup) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const actorIsSuperAdmin = isAccountSuperAdmin(actor);
  const targetIsSuperAdmin = isAccountSuperAdmin(targetAccount);

  // If actor is NOT super admin (just admin):
  if (!actorIsSuperAdmin) {
    if (targetIsSuperAdmin) {
      return NextResponse.json(
        { error: "Only super admins can modify super admin users" },
        { status: 403 }
      );
    }

    // Cannot modify the group of an admin/super admin
    if (targetAccount.role === "admin") {
      return NextResponse.json(
        { error: "Only super admins can modify admin groups" },
        { status: 403 }
      );
    }

    // Cannot assign to admin groups
    if (targetGroup.isAdmin) {
      return NextResponse.json(
        { error: "Admins cannot promote users to admin groups" },
        { status: 403 }
      );
    }
  }

  const result = await setAccountGroupMembership(id, groupId);
  await addLog(
    actor.id,
    "user.group_changed",
    `Changed group of ${targetAccount.email} to ${targetGroup.name}`
  );

  return NextResponse.json(result);
}
