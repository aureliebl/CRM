import { NextResponse } from "next/server";
import { addLog, createAccount, getAccountByEmail, setAccountPassword, toSafeAccount } from "@/lib/account-store";
import { getDefaultGroupId, setAccountGroupMembership } from "@/lib/security-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

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

    return NextResponse.json(toSafeAccount(created), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
