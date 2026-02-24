import { NextResponse } from "next/server";
import {
  addIpAllowlistEntry,
  getIpAllowlistEntries,
  getSecuritySettings,
  updateSecuritySettings,
} from "@/lib/security-store";
import { isActorAdmin } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    settings: getSecuritySettings(),
    entries: getIpAllowlistEntries(),
  });
}

export async function POST(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.ipOrCidr) {
    return NextResponse.json({ error: "ipOrCidr is required" }, { status: 400 });
  }

  const created = addIpAllowlistEntry({
    ipOrCidr: body.ipOrCidr,
    label: body.label,
    isActive: body.isActive !== false,
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!isActorAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updatedSettings = updateSecuritySettings({
    ipAllowlistEnabled: !!body.ipAllowlistEnabled,
  });

  return NextResponse.json(updatedSettings);
}
