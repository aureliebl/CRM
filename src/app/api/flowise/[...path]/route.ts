import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_UPSTREAM = "https://flowise.costockage.fr";

const FLOWISE_TIMEOUT_MS = Math.max(2000, Number(process.env.FLOWISE_TIMEOUT_MS || 20000));
const FLOWISE_RETRY_ATTEMPTS = Math.max(1, Number(process.env.FLOWISE_RETRY_ATTEMPTS || 2));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message ?? "") : "";
  return (
    message.includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ENOTFOUND") ||
    message.includes("socket hang up")
  );
}

function buildUpstreamUrl(pathSegments: string[] | undefined, search: string) {
  const baseUrl = (process.env.FLOWISE_API_HOST || DEFAULT_UPSTREAM).replace(/\/$/, "");
  const normalizedPath = (pathSegments ?? []).join("/");
  const path = normalizedPath ? `/${normalizedPath}` : "";
  return `${baseUrl}${path}${search}`;
}

async function proxy(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const incomingUrl = new URL(req.url);
  const upstreamUrl = buildUpstreamUrl(path, incomingUrl.search);

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("cookie");
  headers.delete("authorization");

  const flowiseApiKey = process.env.FLOWISE_API_KEY?.trim();
  const flowiseAuthorization = process.env.FLOWISE_AUTHORIZATION?.trim();
  if (flowiseApiKey) {
    headers.set("x-api-key", flowiseApiKey);
  }
  if (flowiseAuthorization) {
    headers.set("authorization", flowiseAuthorization);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstreamRes: Response | null = null;

  for (let attempt = 1; attempt <= FLOWISE_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FLOWISE_TIMEOUT_MS);
    try {
      upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body,
        redirect: "follow",
        signal: controller.signal,
      });

      if (upstreamRes.status >= 500 && attempt < FLOWISE_RETRY_ATTEMPTS) {
        await sleep(120 * attempt);
        continue;
      }

      break;
    } catch (error) {
      const retriable = isTransientError(error);
      const isLast = attempt === FLOWISE_RETRY_ATTEMPTS;
      if (!retriable || isLast) {
        break;
      }
      await sleep(120 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!upstreamRes) {
    const host = (process.env.FLOWISE_API_HOST || DEFAULT_UPSTREAM).replace(/\/$/, "");
    return NextResponse.json(
      {
        error: "Flowise upstream unavailable",
        detail: `Could not reach Flowise at ${host}. Make sure the FLOWISE_API_HOST environment variable is correct and the Flowise instance is running.`,
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers(upstreamRes.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function OPTIONS(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    return await proxy(req, ctx);
  } catch {
    return NextResponse.json({}, { status: 204 });
  }
}
