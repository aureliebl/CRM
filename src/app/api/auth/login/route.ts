import { NextResponse } from "next/server";
import { getAccountById } from "@/lib/account-store";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const account = await getAccountById(userId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (!account.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  const token = createSessionToken({ userId: account.id, role: account.role });
  const response = NextResponse.json({
    ok: true,
    user: {
      id: account.id,
      role: account.role,
      email: account.email,
      fullName: account.fullName,
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
