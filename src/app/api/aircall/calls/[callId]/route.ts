import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  answerAircallCall,
  endAircallCall,
  toggleAircallHold,
  toggleAircallMute,
} from "@/lib/aircall-store";
import { performAircallAction } from "@/lib/aircall-provider";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action ?? "";

  if (
    action !== "answer" &&
    action !== "end" &&
    action !== "toggleMute" &&
    action !== "toggleHold"
  ) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const remote = await performAircallAction(callId, action);
  if (!remote.ok && remote.configured) {
    return NextResponse.json({ error: remote.error }, { status: 502 });
  }

  let call = null;

  if (action === "answer") {
    call = answerAircallCall(callId);
  } else if (action === "end") {
    endAircallCall(callId);
    return NextResponse.json({ call: null });
  } else if (action === "toggleMute") {
    call = toggleAircallMute(callId);
  } else if (action === "toggleHold") {
    call = toggleAircallHold(callId);
  }

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  return NextResponse.json({ call });
}
