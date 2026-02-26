import { NextResponse } from "next/server";
import { getAllAccounts, createAccount } from "@/lib/account-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accounts = await getAllAccounts();
  return NextResponse.json(accounts);
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
  return NextResponse.json(created, { status: 201 });
}
