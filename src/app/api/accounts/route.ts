import { NextResponse } from "next/server";
import { createAccount, getAllAccounts, toSafeAccount } from "@/lib/account-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accounts = await getAllAccounts();
  return NextResponse.json(accounts.map(toSafeAccount));
}

export async function POST(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (!body?.email || !body?.fullName) {
    return NextResponse.json({ error: "email and fullName are required" }, { status: 400 });
  }

  const created = await createAccount(body);
  if (!created) return NextResponse.json({ error: "Create account failed" }, { status: 500 });
  return NextResponse.json(toSafeAccount(created), { status: 201 });
}
