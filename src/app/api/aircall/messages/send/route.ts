import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { sendAircallSms } from "@/lib/aircall-provider";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { to?: string; body?: string; numberId?: string }
    | null;

  const to = body?.to?.trim() ?? "";
  const messageBody = body?.body?.trim() ?? "";
  const numberId = body?.numberId?.trim();

  if (!to || !messageBody) {
    return NextResponse.json({ error: "to and body are required" }, { status: 400 });
  }

  const sent = await sendAircallSms({
    to,
    body: messageBody,
    numberId,
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: sent.configured ? 502 : 503 });
  }

  return NextResponse.json({
    sent: true,
    configured: sent.configured,
    messageId: sent.messageId,
  });
}
