import { NextResponse } from "next/server";
import { addLog } from "@/lib/account-store";
import {
  addIpAllowlistEntry,
  getIpAllowlistEntries,
  getSecuritySettings,
  updateSecuritySettings,
} from "@/lib/security-store";
import { getActorIdFromRequest, isActorSuperAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    settings: await getSecuritySettings(),
    entries: await getIpAllowlistEntries(),
  });
}

export async function POST(req: Request) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const body = await req.json();
  if (!body.ipOrCidr) {
    return NextResponse.json({ error: "ipOrCidr is required" }, { status: 400 });
  }

  const created = await addIpAllowlistEntry({
    ipOrCidr: body.ipOrCidr,
    label: body.label,
    isActive: body.isActive !== false,
  });

  if (!created) {
    return NextResponse.json({ error: "Unable to create IP allowlist entry" }, { status: 500 });
  }

  if (actorId) {
    await addLog(actorId, "security.ip_allowlist.created", `IP allowlist entry ${created.id} created by ${actorId}`);
  }

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isActorSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = await getActorIdFromRequest(req);
  const body = await req.json();
  const updatedSettings = await updateSecuritySettings({
    ipAllowlistEnabled: !!body.ipAllowlistEnabled,
  });

  if (actorId) {
    await addLog(actorId, "security.ip_allowlist.settings_updated", `IP allowlist setting updated by ${actorId}`);
  }

  return NextResponse.json(updatedSettings);
}
