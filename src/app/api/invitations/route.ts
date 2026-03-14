import { NextResponse } from "next/server";
import {
  getAllInvitations,
  createInvitation,
  getPendingInvitationByEmail,
  expireOldInvitations,
} from "@/lib/invitation-store";
import { getUserGroups } from "@/lib/security-store";
import { getAccountByEmail, addLog } from "@/lib/account-store";
import { getActorFromRequest, isAccountSuperAdmin } from "@/lib/server-permissions";
import { sendInvitationEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Expire old invitations before listing
  await expireOldInvitations();

  const invitations = await getAllInvitations();
  return NextResponse.json(invitations);
}

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    emails?: string[];
    email?: string;
    groupId?: string;
    role?: string;
  };

  const rawEmails = body.emails ?? (body.email ? [body.email] : []);
  const emails = rawEmails
    .flatMap((e) => e.split(/[,\n]/))
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ error: "At least one email is required" }, { status: 400 });
  }

  const { groupId } = body;
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  // Validate and normalize role
  const actorIsSuperAdmin = isAccountSuperAdmin(actor);
  const requestedRole = body.role === "admin" ? "admin" : "operator";
  if (requestedRole === "admin" && !actorIsSuperAdmin) {
    return NextResponse.json(
      { error: "Only super admins can invite with admin role" },
      { status: 403 }
    );
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  for (const email of emails) {
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: `Invalid email format: ${email}` },
        { status: 400 }
      );
    }
  }

  // Validate group exists
  const groups = await getUserGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Admin (not super admin) cannot invite to admin groups
  if (!actorIsSuperAdmin && group.isAdmin) {
    return NextResponse.json(
      { error: "Only super admins can invite to admin groups" },
      { status: 403 }
    );
  }

  const results: Array<{
    email: string;
    status: "sent" | "already_exists" | "already_invited" | "delivery_failed" | "error";
    error?: string;
    mode?: string;
  }> = [];

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PASSWORD_RESET_URL_BASE?.replace("/resetlogin", "") ||
    "http://localhost:3000";

  for (const email of emails) {
    // Check if user already exists
    const existingAccount = await getAccountByEmail(email);
    if (existingAccount) {
      results.push({ email, status: "already_exists" });
      continue;
    }

    // Check if already invited (pending)
    const existingInvite = await getPendingInvitationByEmail(email);
    if (existingInvite) {
      results.push({ email, status: "already_invited" });
      continue;
    }

    try {
      const { rawToken } = await createInvitation({
        email,
        groupId,
        invitedBy: actor.id,
        role: requestedRole,
      });

      const invitationUrl = `${appBaseUrl}/invitation/${rawToken}`;

      const emailResult = await sendInvitationEmail({
        to: email,
        inviterName: actor.fullName || actor.email,
        groupName: group.name,
        invitationUrl,
      });

      const { delivered, mode, error } = emailResult ?? {};

      if (delivered) {
        await addLog(
          actor.id,
          "invitation.sent",
          `Invited ${email} to group ${group.name}`
        );
        results.push({ email, status: "sent", mode });
      } else {
        await addLog(
          actor.id,
          "invitation.delivery_failed",
          `Failed to deliver invitation to ${email} for group ${group.name}${
            error ? `: ${error}` : ""
          }`
        );
        results.push({
          email,
          status: "delivery_failed",
          error: error || "Invitation email not delivered",
          mode,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ email, status: "error", error: message });
    }
  }

  return NextResponse.json({ results });
}
