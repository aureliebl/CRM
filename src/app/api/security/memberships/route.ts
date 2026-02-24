import { NextResponse } from "next/server";
import { getAccountGroupMemberships, setAccountGroupMembership } from "@/lib/security-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(getAccountGroupMemberships());
}

export async function PUT(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.accountId || !body.groupId) {
    return NextResponse.json({ error: "accountId and groupId are required" }, { status: 400 });
  }

  const membership = setAccountGroupMembership(body.accountId, body.groupId);
  return NextResponse.json(membership);
}
