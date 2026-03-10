import { NextResponse } from "next/server";
import {
  addLog,
  createAccount,
  createPasswordResetToken,
  getAccountByEmail,
  setAccountPassword,
  toSafeAccount,
} from "@/lib/account-store";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { getDefaultGroupId, setAccountGroupMembership } from "@/lib/security-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

function buildResetUrl(token: string): string {
  const baseUrl = process.env.PASSWORD_RESET_URL_BASE || "http://localhost:3000/resetlogin";
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function POST(req: Request) {
  try {
    if (!(await isActorAdmin(req))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const actorId = await getActorIdFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const fullName = String(body?.fullName ?? "").trim();
    const role = body?.role === "admin" ? "admin" : "operator";
    const password = String(body?.password ?? "");

    if (!email || !fullName || !password) {
      return NextResponse.json({ error: "email, fullName and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await getAccountByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }

    const created = await createAccount({
      email,
      fullName,
      role,
      locale: "fr",
      totpEnabled: 0,
    });

    if (!created) {
      return NextResponse.json({ error: "Create account failed" }, { status: 500 });
    }

    await setAccountPassword(created.id, password);

    try {
      await addLog(created.id, "account.created", `Account created by ${actorId ?? "system"}`);
    } catch (error) {
      console.warn("[security/accounts] addLog failed", error);
    }

    if (role === "operator") {
      try {
        const defaultGroupId = await getDefaultGroupId();
        if (defaultGroupId) {
          await setAccountGroupMembership(created.id, defaultGroupId);
        }
      } catch (error) {
        console.warn("[security/accounts] default group assignment failed", error);
      }
    }

    let onboarding:
      | {
          delivered: boolean;
          mode: "smtp" | "log";
          error?: string;
          resetUrl?: string;
          expiresAt?: string;
        }
      | undefined;

    try {
      const { token, expiresAt } = await createPasswordResetToken(created.id, {
        expiresInMinutes: 60,
        createdBy: actorId,
      });
      const resetUrl = buildResetUrl(token);
      const emailResult = await sendPasswordResetEmail({
        to: created.email,
        fullName: created.fullName,
        resetUrl,
      });

      onboarding = {
        delivered: emailResult.delivered,
        mode: emailResult.mode,
        error: emailResult.error,
        resetUrl: emailResult.mode === "log" ? resetUrl : undefined,
        expiresAt,
      };

      await addLog(
        created.id,
        "account.password_reset_email_sent",
        `Password reset email sent to ${created.email} by ${actorId ?? "system"}`
      );
    } catch (error) {
      console.warn("[security/accounts] onboarding reset email failed", error);
    }

    return NextResponse.json({ ...toSafeAccount(created), onboarding }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
