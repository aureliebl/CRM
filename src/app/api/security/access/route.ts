import { NextResponse } from "next/server";
import { getIpAllowlistEntries, getSecuritySettings } from "@/lib/security-store";
import { isIpInCidr, normalizeClientIp } from "@/lib/ip-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const settings = getSecuritySettings();
  const entries = getIpAllowlistEntries().filter((entry) => entry.isActive);

  const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const clientIp = normalizeClientIp(rawIp) ?? "127.0.0.1";

  if (!settings.ipAllowlistEnabled) {
    return NextResponse.json({
      enabled: false,
      allowed: true,
      clientIp,
    });
  }

  const allowed = entries.some((entry) => isIpInCidr(clientIp, entry.ipOrCidr));

  return NextResponse.json({
    enabled: true,
    allowed,
    clientIp,
  });
}
