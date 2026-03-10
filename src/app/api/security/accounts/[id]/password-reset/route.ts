import { NextResponse } from "next/server";
import { addLog, createPasswordResetToken, getAccountById } from "@/lib/account-store";
import { consumeAuthRateLimit, getClientIp, maybeCleanupAuthRateLimits } from "@/lib/auth-rate-limit";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

function buildResetUrl(token: string): string {
  const baseUrl = process.env.PASSWORD_RESET_URL_BASE || "http://localhost:3000/resetlogin";
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const ip = getClientIp(req);

  await maybeCleanupAuthRateLimits();

  const limitResult = await consumeAuthRateLimit({
    action: "password_reset_email_send",
    scope: `${ip}|${actorId ?? "unknown"}`,
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

  const { id } = await params;
  const account = await getAccountById(id);

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!account.email) {
    return NextResponse.json({ error: "Account has no email" }, { status: 400 });
  }

  const { token, expiresAt } = await createPasswordResetToken(account.id, {
    expiresInMinutes: 60,
    createdBy: actorId,
  });
  const resetUrl = buildResetUrl(token);
  const emailResult = await sendPasswordResetEmail({
    to: account.email,
    fullName: account.fullName,
    resetUrl,
  });

  await addLog(
    account.id,
    "account.password_reset_email_sent",
    `Password reset email sent to ${account.email} by ${actorId ?? "system"}`
  );

  return NextResponse.json({
    ok: true,
    delivered: emailResult.delivered,
    mode: emailResult.mode,
    error: emailResult.error,
    expiresAt,
    resetUrl: emailResult.mode === "log" ? resetUrl : undefined,
  });
}
