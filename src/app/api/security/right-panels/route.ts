import { NextResponse } from "next/server";
import { getMergedRightPanelConfigs } from "@/lib/right-panel-config-service";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await getMergedRightPanelConfigs();
  return NextResponse.json(configs);
}
