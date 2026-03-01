import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import { fetchAircallContacts } from "@/lib/aircall-provider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Number(url.searchParams.get("perPage") ?? "50");

  const result = await fetchAircallContacts(page, perPage);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.configured ? 502 : 503 });
  }

  return NextResponse.json({
    configured: result.configured,
    contacts: result.contacts,
    page: result.page,
    perPage: result.perPage,
    total: result.total,
  });
}
