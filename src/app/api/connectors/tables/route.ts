import { NextResponse } from "next/server";
import { isActorAdmin } from "@/lib/server-permissions";
import { listConnectorTables } from "@/lib/connector-runtime";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const connectorId = url.searchParams.get("connectorId") ?? undefined;
  const result = await listConnectorTables(connectorId);

  if (result.error) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
