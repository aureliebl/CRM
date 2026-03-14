import { NextResponse } from "next/server";
import { cancelInvitation, getInvitationById } from "@/lib/invitation-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import { addLog } from "@/lib/account-store";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const invitation = await getInvitationById(id);
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending invitations can be cancelled" },
      { status: 400 }
    );
  }

  await cancelInvitation(id);
  await addLog(actor.id, "invitation.cancelled", `Cancelled invitation for ${invitation.email}`);

  return NextResponse.json({ success: true });
}
