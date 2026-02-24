import type { LiveUserSession } from "@/lib/types";

let sessions: LiveUserSession[] = [
  {
    id: "s1",
    anonymousId: "anon-123",
    currentCenterId: "ctr-paris-01",
    currentBoxSizeRange: "1-3m²",
    startedAt: "2024-02-12T09:00:00Z",
    lastSeenAt: "2024-02-12T09:10:00Z",
    deviceType: "desktop",
    referrer: "google / cpc",
    page: "/centres/paris-01",
  },
  {
    id: "s2",
    clientId: "c1",
    currentCenterId: "ctr-paris-01",
    currentBoxSizeRange: "3-5m²",
    startedAt: "2024-02-12T08:50:00Z",
    lastSeenAt: "2024-02-12T09:11:00Z",
    deviceType: "mobile",
    referrer: "direct",
    page: "/booking/paris-01/step-2",
  },
  {
    id: "s3",
    clientId: "c4",
    currentCenterId: "ctr-bordeaux-04",
    currentBoxSizeRange: "3-5m²",
    startedAt: "2024-02-12T08:40:00Z",
    lastSeenAt: "2024-02-12T09:12:00Z",
    deviceType: "desktop",
    referrer: "google / seo",
    page: "/centres/bordeaux-04",
  },
  {
    id: "s4",
    anonymousId: "anon-456",
    currentCenterId: "ctr-lille-05",
    currentBoxSizeRange: "1-2m²",
    startedAt: "2024-02-12T09:05:00Z",
    lastSeenAt: "2024-02-12T09:12:30Z",
    deviceType: "mobile",
    referrer: "instagram / social",
    page: "/centres/lille-05",
  },
  {
    id: "s5",
    clientId: "c6",
    currentCenterId: "ctr-lille-05",
    currentBoxSizeRange: "5-7m²",
    startedAt: "2024-02-12T08:15:00Z",
    lastSeenAt: "2024-02-12T09:13:00Z",
    deviceType: "desktop",
    referrer: "direct",
    page: "/booking/lille-05/step-3",
  },
  {
    id: "s6",
    anonymousId: "anon-789",
    currentCenterId: "ctr-toulouse-06",
    currentBoxSizeRange: "3-6m²",
    startedAt: "2024-02-12T09:01:00Z",
    lastSeenAt: "2024-02-12T09:13:20Z",
    deviceType: "tablet",
    referrer: "bing / cpc",
    page: "/centres/toulouse-06",
  },
  {
    id: "s7",
    clientId: "c8",
    currentCenterId: "ctr-marseille-03",
    currentBoxSizeRange: "2-5m²",
    startedAt: "2024-02-12T08:20:00Z",
    lastSeenAt: "2024-02-12T09:13:40Z",
    deviceType: "mobile",
    referrer: "facebook / ads",
    page: "/dashboard/client/c8",
  },
  {
    id: "s8",
    anonymousId: "anon-892",
    currentCenterId: "ctr-paris-01",
    currentBoxSizeRange: "1-3m²",
    startedAt: "2024-02-12T09:07:00Z",
    lastSeenAt: "2024-02-12T09:14:00Z",
    deviceType: "desktop",
    referrer: "partner / affiliate",
    page: "/booking/paris-01/step-1",
  },
  {
    id: "s9",
    clientId: "c11",
    currentCenterId: "ctr-lyon-02",
    currentBoxSizeRange: "6-8m²",
    startedAt: "2024-02-12T08:10:00Z",
    lastSeenAt: "2024-02-12T09:14:20Z",
    deviceType: "desktop",
    referrer: "direct",
    page: "/centres/lyon-02",
  },
  {
    id: "s10",
    anonymousId: "anon-940",
    currentCenterId: "ctr-bordeaux-04",
    currentBoxSizeRange: "1-4m²",
    startedAt: "2024-02-12T09:09:00Z",
    lastSeenAt: "2024-02-12T09:14:40Z",
    deviceType: "mobile",
    referrer: "tiktok / social",
    page: "/landing/storage-deals",
  },
  {
    id: "s11",
    clientId: "c12",
    currentCenterId: "ctr-bordeaux-04",
    currentBoxSizeRange: "4-6m²",
    startedAt: "2024-02-12T08:45:00Z",
    lastSeenAt: "2024-02-12T09:15:00Z",
    deviceType: "tablet",
    referrer: "newsletter",
    page: "/booking/bordeaux-04/confirmation",
  },
  {
    id: "s12",
    anonymousId: "anon-1001",
    currentCenterId: "ctr-toulouse-06",
    currentBoxSizeRange: "3-5m²",
    startedAt: "2024-02-12T09:11:00Z",
    lastSeenAt: "2024-02-12T09:15:20Z",
    deviceType: "desktop",
    referrer: "google / seo",
    page: "/faq",
  },
];

const generatedLiveCenters = [
  "ctr-paris-01",
  "ctr-lyon-02",
  "ctr-marseille-03",
  "ctr-bordeaux-04",
  "ctr-lille-05",
  "ctr-toulouse-06",
] as const;

const generatedLiveRanges = [
  "1-2m²",
  "1-3m²",
  "2-5m²",
  "3-6m²",
  "4-6m²",
  "5-7m²",
  "6-8m²",
] as const;

const generatedLivePages = [
  "/centres/paris-01",
  "/centres/lyon-02",
  "/centres/marseille-03",
  "/centres/bordeaux-04",
  "/booking/paris-01/step-1",
  "/booking/lille-05/step-2",
  "/booking/toulouse-06/step-3",
  "/landing/storage-deals",
  "/faq",
] as const;

const generatedReferrers = [
  "direct",
  "google / seo",
  "google / cpc",
  "facebook / ads",
  "instagram / social",
  "partner / affiliate",
  "newsletter",
] as const;

for (let index = 13; index <= 72; index++) {
  const startedAt = new Date(Date.UTC(2024, 1, 12, 8 + (index % 9), index % 60, 0));
  const lastSeenAt = new Date(startedAt.getTime() + ((index % 25) + 3) * 60 * 1000);

  sessions.push({
    id: `s${index}`,
    clientId: index % 2 === 0 ? `c${1 + (index % 52)}` : undefined,
    anonymousId: index % 2 !== 0 ? `anon-${1000 + index}` : undefined,
    currentCenterId: generatedLiveCenters[index % generatedLiveCenters.length],
    currentBoxSizeRange: generatedLiveRanges[index % generatedLiveRanges.length],
    startedAt: startedAt.toISOString(),
    lastSeenAt: lastSeenAt.toISOString(),
    deviceType: index % 3 === 0 ? "desktop" : index % 3 === 1 ? "mobile" : "tablet",
    referrer: generatedReferrers[index % generatedReferrers.length],
    page: generatedLivePages[index % generatedLivePages.length],
  });
}

let sortedSessionsCache: LiveUserSession[] | null = null;

function invalidateSessionsCache() {
  sortedSessionsCache = null;
}

function getSortedSessions(): LiveUserSession[] {
  if (sortedSessionsCache) return sortedSessionsCache;
  sortedSessionsCache = sessions
    .slice()
    .sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
  return sortedSessionsCache;
}

export function getLiveUsers(): LiveUserSession[] {
  return getSortedSessions();
}

export function simulateHeartbeat() {
  sessions = sessions.map((s, index) => {
    const lastSeen = new Date(s.lastSeenAt);
    const updatedLastSeen = new Date(
      lastSeen.getTime() + (index + 1) * 60 * 1000
    );
    return {
      ...s,
      lastSeenAt: updatedLastSeen.toISOString(),
    };
  });
  invalidateSessionsCache();
}

