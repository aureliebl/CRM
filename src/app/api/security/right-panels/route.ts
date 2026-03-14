import { NextResponse } from "next/server";
import { getMergedRightPanelConfigs } from "@/lib/right-panel-config-service";
import { isActorSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await getMergedRightPanelConfigs();
  return NextResponse.json(configs);
}
