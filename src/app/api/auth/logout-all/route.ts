import { NextResponse } from "next/server";
import { addLog, bumpAccountSessionVersion } from "@/lib/account-store";
import { getActorFromRequest } from "@/lib/server-permissions";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await bumpAccountSessionVersion(actor.id);
  await addLog(actor.id, "auth.logout_all", "Global logout executed");

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return response;
}
