import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { receiveAircallCall } from "@/lib/aircall-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { phoneNumber?: string } | null;
  const phoneNumber = body?.phoneNumber?.trim();
  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
  }

  const call = receiveAircallCall(phoneNumber);
  return NextResponse.json({ call });
}
