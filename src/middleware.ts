import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "costockage_session";

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  const secret = process.env.APP_SESSION_SECRET || process.env.APP_ENCRYPTION_KEY || "costockage-dev-session-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const expectedSigB64 = bytesToBase64Url(new Uint8Array(signature));
  if (expectedSigB64 !== sigB64) return false;

  try {
    const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as { userId?: string; exp?: number };
    if (!payload?.userId || !payload?.exp) return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");

  const isPublicPath =
    pathname === "/login" ||
    pathname === "/resetlogin" ||
    pathname.startsWith("/invitation/") ||
    pathname === "/api/security/access" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/password-login" ||
    pathname === "/api/auth/request-password-reset" ||
    pathname === "/api/auth/reset-password" ||
    pathname === "/api/auth/logout-all" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/api/invitations/verify/") ||
    pathname.startsWith("/api/invitations/accept/") ||
    pathname === "/api/tickets/ingest";

  if (isPublicPath) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidSessionToken(token);

  if (valid) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
