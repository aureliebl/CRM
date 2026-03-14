import { NextResponse } from "next/server";
import { getAccountById, deleteAccount, addLog } from "@/lib/account-store";
import { getGroupIdForAccount, getUserGroups } from "@/lib/security-store";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const account = await getAccountById(id);
  if (!account) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const groupId = await getGroupIdForAccount(id);
  const groups = await getUserGroups();
  const group = groupId ? groups.find((g) => g.id === groupId) : undefined;

  return NextResponse.json({
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
    isActive: account.isActive,
    profileImage: account.profileImage,
    groupId: groupId ?? null,
    groupName: group?.name ?? null,
    createdAt: account.createdAt,
  });
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

  if (id === actor.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const account = await getAccountById(id);
  if (!account) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await deleteAccount(id);
  await addLog(actor.id, "user.deleted", `Deleted user ${account.email}`);

  return NextResponse.json({ success: true });
}
