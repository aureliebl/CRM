import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/account-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 80);
  return NextResponse.json({ logs: await getRecentLogs(limit) });
}
