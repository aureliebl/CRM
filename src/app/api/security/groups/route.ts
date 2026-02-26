import { NextResponse } from "next/server";
import { createUserGroup, getUserGroups } from "@/lib/security-store";
import { isActorAdmin } from "@/lib/server-permissions";

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

  const body = await req.json();
  const created = await createUserGroup({
    name: body.name,
    description: body.description,
    isDefault: !!body.isDefault,
  });

  return NextResponse.json(created, { status: 201 });
}
