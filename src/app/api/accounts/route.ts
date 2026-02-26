import { NextResponse } from "next/server";
import { getAllAccounts, createAccount } from "@/lib/account-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await getAllAccounts();
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await createAccount(body);
  return NextResponse.json(created, { status: 201 });
}
