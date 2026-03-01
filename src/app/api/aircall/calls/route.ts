import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { getAircallActiveCall, startAircallCall } from "@/lib/aircall-store";
import { createAircallOutboundCall } from "@/lib/aircall-provider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ call: getAircallActiveCall() });
}

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

  const remote = await createAircallOutboundCall(phoneNumber, actor.id);
  if (!remote.ok && remote.configured) {
    return NextResponse.json({ error: remote.error }, { status: 502 });
  }

  const remoteCallId = remote.ok ? remote.callId : undefined;
  const call = startAircallCall(phoneNumber, actor.id, remoteCallId);
  return NextResponse.json({ call }, { status: 201 });
}
