import { NextResponse } from "next/server";
import {
  getUserGroups,
  updateUserGroup,
  deleteUserGroup,
  getAccountGroupMemberships,
  getAccountGroupInvitations,
} from "@/lib/security-store";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { addLog } from "@/lib/account-store";

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
  const groups = await getUserGroups();
  const group = groups.find((g) => g.id === id);

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Cannot modify admin/system groups
  if (group.isAdmin) {
    return NextResponse.json(
      { error: "System groups cannot be modified" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as { name?: string; description?: string };

  const updated = await updateUserGroup(id, {
    name: body.name?.trim() || group.name,
    description: body.description?.trim() || group.description,
  });

  await addLog(actor.id, "group.updated", `Updated group "${group.name}"`);

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || !isAccountSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const groups = await getUserGroups();
  const group = groups.find((g) => g.id === id);

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (group.isAdmin) {
    return NextResponse.json(
      { error: "System groups cannot be deleted" },
      { status: 403 }
    );
  }

  // Check if group has members
  const memberships = await getAccountGroupMemberships();
  const memberCount = memberships.filter((m) => m.groupId === id).length;

  if (memberCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a group that has members" },
      { status: 400 }
    );
  }

  // Check if group has pending/unaccepted invitations
  const invitations = await getAccountGroupInvitations();
  const pendingInvitationCount = invitations.filter(
    (invitation) => invitation.groupId === id && !invitation.acceptedAt
  ).length;

  if (pendingInvitationCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a group that has pending invitations" },
      { status: 400 }
    );
  }

  await deleteUserGroup(id);
  await addLog(actor.id, "group.deleted", `Deleted group "${group.name}"`);

  return NextResponse.json({ success: true });
}
