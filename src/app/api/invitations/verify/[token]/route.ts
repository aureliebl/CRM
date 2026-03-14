import { NextResponse } from "next/server";
import { getInvitationByToken } from "@/lib/invitation-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return NextResponse.json(
      { error: "This invitation link is invalid or has expired." },
      { status: 404 }
    );
  }

  if (invitation.status === "accepted") {
    return NextResponse.json(
      { error: "This invitation has already been accepted." },
      { status: 410 }
    );
  }

  if (
    invitation.status === "expired" ||
    new Date(invitation.expiresAt) < new Date()
  ) {
    return NextResponse.json(
      { error: "This invitation link has expired." },
      { status: 410 }
    );
  }

  return NextResponse.json({
    email: invitation.email,
    groupId: invitation.groupId,
  });
}
