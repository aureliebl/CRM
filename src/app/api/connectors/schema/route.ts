import { NextResponse } from "next/server";
import { isActorAdmin } from "@/lib/server-permissions";
import { getConnectorTableSchema } from "@/lib/connector-runtime";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const table = (url.searchParams.get("table") || "").trim();
  const connectorId = url.searchParams.get("connectorId") || undefined;

  if (!table) {
    return NextResponse.json({ error: "table query param is required" }, { status: 400 });
  }

  const result = await getConnectorTableSchema({
    preferredConnectorId: connectorId,
    table,
  });

  return NextResponse.json(result);
}
