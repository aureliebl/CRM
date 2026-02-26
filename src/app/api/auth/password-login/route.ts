import { NextResponse } from "next/server";
import { authenticateAccount, getAccountByEmail } from "@/lib/account-store";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  let account = await authenticateAccount(email, password);

  if (!account && process.env.DEMO_AUTH === "true" && password === "demo123") {
    account = await getAccountByEmail(email);
  }

  if (!account) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!account.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  const token = createSessionToken({ userId: account.id, role: account.role });
  const response = NextResponse.json({
    ok: true,
    user: {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      fullName: account.fullName,
      role: account.role,
      isActive: !!account.isActive,
      profileImage: account.profileImage,
      totpEnabled: Boolean(account.totpEnabled),
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
