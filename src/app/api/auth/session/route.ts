import { NextResponse } from "next/server";
import { getAccountById } from "@/lib/account-store";
import { getSessionFromRequest } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const account = await getAccountById(session.userId);
  if (!account) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
    },
  });
}
