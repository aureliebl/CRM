import { NextResponse } from "next/server";
import { resendInvitation, getInvitationById } from "@/lib/invitation-store";
import { getUserGroups } from "@/lib/security-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import { addLog } from "@/lib/account-store";
import { sendInvitationEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(
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

  if (invitation.status !== "pending" && invitation.status !== "expired") {
    return NextResponse.json(
      { error: "Only pending or expired invitations can be resent" },
      { status: 400 }
    );
  }

  const updated = await resendInvitation(id);
  if (!updated) {
    return NextResponse.json({ error: "Failed to resend invitation" }, { status: 500 });
  }

  const groups = await getUserGroups();
  const group = groups.find((g) => g.id === updated.groupId);

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PASSWORD_RESET_URL_BASE?.replace("/resetlogin", "") ||
    "http://localhost:3000";

  const invitationUrl = `${appBaseUrl}/invitation/${updated.token}`;

  await sendInvitationEmail({
    to: updated.email,
    inviterName: actor.fullName || actor.email,
    groupName: group?.name ?? "Unknown",
    invitationUrl,
  });

  await addLog(actor.id, "invitation.resent", `Resent invitation to ${updated.email}`);

  const { token, ...safeInvitation } = updated;
  return NextResponse.json(safeInvitation);
}
