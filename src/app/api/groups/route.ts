import { NextResponse } from "next/server";
import { getUserGroups, createUserGroup, getAccountGroupMemberships } from "@/lib/security-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import { addLog } from "@/lib/account-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = await getUserGroups();
  const memberships = await getAccountGroupMemberships();

  // Count members per group
  const memberCounts = new Map<string, number>();
  for (const m of memberships) {
    memberCounts.set(m.groupId, (memberCounts.get(m.groupId) ?? 0) + 1);
  }

  const result = groups.map((g) => ({
    ...g,
    memberCount: memberCounts.get(g.id) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; description?: string };
  const { name, description } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  // New groups are always non-admin
  const group = await createUserGroup({
    name: name.trim(),
    description: description?.trim() || undefined,
    isDefault: false,
  });

  await addLog(actor.id, "group.created", `Created group "${name.trim()}"`);

  return NextResponse.json(group, { status: 201 });
}
