export function getExpectedUpdatedAt(req: Request, body: unknown): string | null {
  const fromBody =
    body && typeof body === "object" && "expectedUpdatedAt" in body
      ? String((body as { expectedUpdatedAt?: unknown }).expectedUpdatedAt ?? "").trim()
      : "";

  if (fromBody) return fromBody;

  const fromHeader = req.headers.get("if-unmodified-since")?.trim() ?? "";
  return fromHeader || null;
}

export function isStaleWrite(expectedUpdatedAt: string | null, currentUpdatedAt: string | null | undefined): boolean {
  if (!expectedUpdatedAt) return false;
  if (!currentUpdatedAt) return false;

  const expectedTs = new Date(expectedUpdatedAt).getTime();
  const currentTs = new Date(currentUpdatedAt).getTime();
  if (!Number.isFinite(expectedTs) || !Number.isFinite(currentTs)) return false;

  return expectedTs !== currentTs;
}
