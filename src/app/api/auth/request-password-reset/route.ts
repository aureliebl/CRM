import { NextResponse } from "next/server";
import { addLog, createPasswordResetToken, getAccountByEmail } from "@/lib/account-store";
import { consumeAuthRateLimit, getClientIp, maybeCleanupAuthRateLimits } from "@/lib/auth-rate-limit";
import { sendPasswordResetEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

function buildResetUrl(token: string): string {
  const baseUrl = process.env.PASSWORD_RESET_URL_BASE || "http://localhost:3000/resetlogin";
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const ip = getClientIp(req);

  await maybeCleanupAuthRateLimits();

  const limitResult = await consumeAuthRateLimit({
    action: "password_reset_request",
    scope: `${ip}|${email || "unknown"}`,
    maxAttempts: Number(process.env.AUTH_RATE_LIMIT_RESET_EMAIL_MAX ?? 30),
    windowMs: Number(process.env.AUTH_RATE_LIMIT_RESET_EMAIL_WINDOW_MS ?? 60 * 60 * 1000),
    blockMs: Number(process.env.AUTH_RATE_LIMIT_RESET_EMAIL_BLOCK_MS ?? 60 * 60 * 1000),
  });

  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limitResult.retryAfterSeconds),
        },
      }
    );
  }

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const account = await getAccountByEmail(email);

  if (account?.isActive && account.email) {
    const { token } = await createPasswordResetToken(account.id, {
      expiresInMinutes: 60,
      createdBy: "self-service",
    });

    const resetUrl = buildResetUrl(token);
    await sendPasswordResetEmail({
      to: account.email,
      fullName: account.fullName,
      resetUrl,
    });

    await addLog(account.id, "account.password_reset_requested", `Self-service password reset requested for ${account.email}`);
  }

  return NextResponse.json({
    ok: true,
    message: "If this email exists, a reset link has been sent.",
  });
}
