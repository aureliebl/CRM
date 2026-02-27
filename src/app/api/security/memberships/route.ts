import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { getAccountGroupMemberships, setAccountGroupMembership } from "@/lib/security-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await getAccountGroupMemberships());
}

export async function PUT(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const body = await req.json();
  if (!body.accountId || !body.groupId) {
    return NextResponse.json({ error: "accountId and groupId are required" }, { status: 400 });
  }

  const membership = await setAccountGroupMembership(body.accountId, body.groupId);
  if (actorId) {
    await addLog(actorId, "security.membership.updated", `Membership updated for ${body.accountId} by ${actorId}`);
  }
  return NextResponse.json(membership);
}
