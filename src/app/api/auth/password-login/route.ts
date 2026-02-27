import { NextResponse } from "next/server";
import { addLog, authenticateAccount, getAccountByEmail } from "@/lib/account-store";
import { consumeAuthRateLimit, getClientIp, maybeCleanupAuthRateLimits } from "@/lib/auth-rate-limit";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const ip = getClientIp(req);

  await maybeCleanupAuthRateLimits();

  const limitResult = await consumeAuthRateLimit({
    action: "password_login",
    scope: `${ip}|${email || "unknown"}`,
    maxAttempts: Number(process.env.AUTH_RATE_LIMIT_LOGIN_MAX ?? 8),
    windowMs: Number(process.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS ?? 15 * 60 * 1000),
    blockMs: Number(process.env.AUTH_RATE_LIMIT_LOGIN_BLOCK_MS ?? 15 * 60 * 1000),
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limitResult.retryAfterSeconds),
        },
      }
    );
  }

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
    await addLog(account.id, "auth.login_blocked", "Blocked login attempt on disabled account");
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  await addLog(account.id, "auth.login_success", "Password login successful");

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
