import { NextResponse } from "next/server";
import { addLog, authenticateAccount, getAccountById, setAccountPassword } from "@/lib/account-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import { consumeAuthRateLimit, getClientIp, maybeCleanupAuthRateLimits } from "@/lib/auth-rate-limit";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");
  const ip = getClientIp(req);

  await maybeCleanupAuthRateLimits();

  const limitResult = await consumeAuthRateLimit({
    action: "change_password",
    scope: `${ip}|${actor.id}`,
    maxAttempts: Number(process.env.AUTH_RATE_LIMIT_CHANGE_PASSWORD_MAX ?? 8),
    windowMs: Number(process.env.AUTH_RATE_LIMIT_CHANGE_PASSWORD_WINDOW_MS ?? 15 * 60 * 1000),
    blockMs: Number(process.env.AUTH_RATE_LIMIT_CHANGE_PASSWORD_BLOCK_MS ?? 15 * 60 * 1000),
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

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "currentPassword, newPassword and confirmPassword are required" }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New password confirmation does not match" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  let accountCheck = await authenticateAccount(actor.email, currentPassword);
  if (!accountCheck && process.env.DEMO_AUTH === "true" && currentPassword === "demo123") {
    accountCheck = await getAccountById(actor.id);
  }

  if (!accountCheck || accountCheck.id !== actor.id) {
    await addLog(actor.id, "account.password_change_failed", "Current password verification failed");
    return NextResponse.json({ error: "Current password is invalid" }, { status: 401 });
  }

  await setAccountPassword(actor.id, newPassword);

  const updated = await getAccountById(actor.id);
  if (!updated) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await addLog(actor.id, "account.password_changed", "Password changed by authenticated user");

  const token = createSessionToken({
    userId: updated.id,
    role: updated.role,
    sessionVersion: updated.sessionVersion,
  });

  const response = NextResponse.json({ ok: true });
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
