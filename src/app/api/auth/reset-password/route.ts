import { NextResponse } from "next/server";
import { addLog, consumePasswordResetToken, getAccountById, setAccountPassword } from "@/lib/account-store";
import { consumeAuthRateLimit, getClientIp, maybeCleanupAuthRateLimits } from "@/lib/auth-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");
  const ip = getClientIp(req);

  await maybeCleanupAuthRateLimits();

  const limitResult = await consumeAuthRateLimit({
    action: "reset_password_submit",
    scope: ip,
    maxAttempts: Number(process.env.AUTH_RATE_LIMIT_RESET_SUBMIT_MAX ?? 8),
    windowMs: Number(process.env.AUTH_RATE_LIMIT_RESET_SUBMIT_WINDOW_MS ?? 15 * 60 * 1000),
    blockMs: Number(process.env.AUTH_RATE_LIMIT_RESET_SUBMIT_BLOCK_MS ?? 15 * 60 * 1000),
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

  if (!token || !password) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const consumed = await consumePasswordResetToken(token);
  if (!consumed) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const account = await getAccountById(consumed.accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await setAccountPassword(account.id, password);
  await addLog(account.id, "account.password_reset_completed", "Password reset completed from reset link");

  return NextResponse.json({ ok: true });
}
