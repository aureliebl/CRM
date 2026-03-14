import { NextResponse } from "next/server";
import { getInvitationByToken, acceptInvitation } from "@/lib/invitation-store";
import { getAccountByEmail, createAccount, setAccountPassword } from "@/lib/account-store";
import { setAccountGroupMembership } from "@/lib/security-store";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
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

  const body = (await req.json()) as {
    name?: string;
    password?: string;
    profilePhoto?: string;
  };

  const { name, password, profilePhoto } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Password strength: at least 1 uppercase, 1 digit, 1 special char
  if (!/[A-Z]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one uppercase letter" },
      { status: 400 }
    );
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one digit" },
      { status: 400 }
    );
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one special character" },
      { status: 400 }
    );
  }

  // Check if email already taken
  const existingAccount = await getAccountByEmail(invitation.email);
  if (existingAccount) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  // Create account
  const account = await createAccount({
    email: invitation.email,
    fullName: name.trim(),
    role: invitation.role ?? "operator",
    isActive: 1,
    profileImage: profilePhoto || null,
  });

  if (!account) {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }

  // Set password
  await setAccountPassword(account.id, password);

  // Ensure the invitation has a valid group and set group membership
  if (!invitation.groupId) {
    return NextResponse.json(
      { error: "The group linked to this invitation is no longer available." },
      { status: 400 }
    );
  }

  try {
    await setAccountGroupMembership(account.id, invitation.groupId);
  } catch (error) {
    return NextResponse.json(
      { error: "The group linked to this invitation is no longer available." },
      { status: 400 }
    );
  }

  // Mark invitation as accepted
  await acceptInvitation(invitation.id);

  // Create session token
  const sessionToken = createSessionToken({
    userId: account.id,
    role: account.role,
    sessionVersion: account.sessionVersion,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
