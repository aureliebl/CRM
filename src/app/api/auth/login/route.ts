import { NextResponse } from "next/server";
import { addLog, getAccountById } from "@/lib/account-store";
import { consumeAuthRateLimit, getClientIp, maybeCleanupAuthRateLimits } from "@/lib/auth-rate-limit";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  const ip = getClientIp(req);

  await maybeCleanupAuthRateLimits();

  const limitResult = await consumeAuthRateLimit({
    action: "internal_login",
    scope: `${ip}|${userId || "unknown"}`,
    maxAttempts: Number(process.env.AUTH_RATE_LIMIT_INTERNAL_LOGIN_MAX ?? 20),
    windowMs: Number(process.env.AUTH_RATE_LIMIT_INTERNAL_LOGIN_WINDOW_MS ?? 15 * 60 * 1000),
    blockMs: Number(process.env.AUTH_RATE_LIMIT_INTERNAL_LOGIN_BLOCK_MS ?? 15 * 60 * 1000),
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

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const account = await getAccountById(userId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (!account.isActive) {
    await addLog(account.id, "auth.login_blocked", "Blocked login attempt on disabled account");
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  await addLog(account.id, "auth.login_success", "Internal login successful");

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
