import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import { createUserGroup, getUserGroups } from "@/lib/security-store";
import { getActorIdFromRequest, isActorAdmin } from "@/lib/server-permissions";
import { clearMemoryCacheByPrefix } from "@/lib/server-memory-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await getUserGroups());
}

export async function POST(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const body = await req.json();
  const created = await createUserGroup({
    name: body.name,
    description: body.description,
    isDefault: !!body.isDefault,
  });

  if (!created) {
    return NextResponse.json({ error: "Unable to create group" }, { status: 500 });
  }

  clearMemoryCacheByPrefix("security:overview");

  if (actorId) {
    await addLog(actorId, "security.group.created", `Group ${created.id} created by ${actorId}`);
  }

  return NextResponse.json(created, { status: 201 });
}
