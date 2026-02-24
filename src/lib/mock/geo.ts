export type GeoAiSourceType = "crawler" | "chat-referral" | "assistant-browser";
export type GeoAnswerPresence = "citation" | "mention" | "none";
export type GeoIntent = "information" | "comparison" | "transaction";

export interface GeoAiEvent {
  id: string;
  detectedAt: string;
  provider: string;
  aiAgent: string;
  model: string;
  sourceType: GeoAiSourceType;
  landingPage: string;
  query: string;
  qualityScore: number;
  intent: GeoIntent;
  answerPresence: GeoAnswerPresence;
  estimatedClicks: number;
  userAgent: string;
}

const geoAiEvents: GeoAiEvent[] = [
  {
    id: "geo-evt-001",
    detectedAt: "2026-02-23T09:12:00.000Z",
    provider: "OpenAI",
    aiAgent: "ChatGPT",
    model: "gpt-4.1",
    sourceType: "chat-referral",
    landingPage: "/boxes/paris-11",
    query: "garde meuble paris 11 pas cher",
    qualityScore: 86,
    intent: "transaction",
    answerPresence: "citation",
    estimatedClicks: 3,
    userAgent: "ChatGPT-User/1.0",
  },
  {
    id: "geo-evt-002",
    detectedAt: "2026-02-23T11:45:00.000Z",
    provider: "Perplexity",
    aiAgent: "Perplexity",
    model: "sonar-pro",
    sourceType: "chat-referral",
    landingPage: "/centers/paris-01",
    query: "comparatif box stockage paris 2026",
    qualityScore: 79,
    intent: "comparison",
    answerPresence: "citation",
    estimatedClicks: 2,
    userAgent: "PerplexityBot/2.0",
  },
  {
    id: "geo-evt-003",
    detectedAt: "2026-02-22T16:02:00.000Z",
    provider: "Google",
    aiAgent: "Gemini",
    model: "gemini-2.0-flash",
    sourceType: "assistant-browser",
    landingPage: "/tarifs/paris-01",
    query: "prix box 2m2 paris",
    qualityScore: 71,
    intent: "information",
    answerPresence: "mention",
    estimatedClicks: 1,
    userAgent: "Google-Extended",
  },
  {
    id: "geo-evt-004",
    detectedAt: "2026-02-22T08:18:00.000Z",
    provider: "Anthropic",
    aiAgent: "Claude",
    model: "claude-3.5-sonnet",
    sourceType: "assistant-browser",
    landingPage: "/faq",
    query: "comment fonctionne la résiliation d'un box",
    qualityScore: 83,
    intent: "information",
    answerPresence: "citation",
    estimatedClicks: 2,
    userAgent: "ClaudeBot/1.0",
  },
  {
    id: "geo-evt-005",
    detectedAt: "2026-02-21T13:27:00.000Z",
    provider: "Microsoft",
    aiAgent: "Copilot",
    model: "copilot-web",
    sourceType: "assistant-browser",
    landingPage: "/pricing",
    query: "self storage paris prix moyen",
    qualityScore: 67,
    intent: "comparison",
    answerPresence: "none",
    estimatedClicks: 0,
    userAgent: "bingbot/2.0",
  },
  {
    id: "geo-evt-006",
    detectedAt: "2026-02-21T06:10:00.000Z",
    provider: "OpenAI",
    aiAgent: "GPTBot",
    model: "crawler",
    sourceType: "crawler",
    landingPage: "/",
    query: "",
    qualityScore: 0,
    intent: "information",
    answerPresence: "none",
    estimatedClicks: 0,
    userAgent: "GPTBot/1.2",
  },
  {
    id: "geo-evt-007",
    detectedAt: "2026-02-20T19:33:00.000Z",
    provider: "Mistral",
    aiAgent: "Le Chat",
    model: "mistral-large",
    sourceType: "chat-referral",
    landingPage: "/centers/lyon-02",
    query: "box de stockage lyon accès 24h/24",
    qualityScore: 77,
    intent: "transaction",
    answerPresence: "mention",
    estimatedClicks: 1,
    userAgent: "MistralAI-User/1.0",
  },
  {
    id: "geo-evt-008",
    detectedAt: "2026-02-20T10:05:00.000Z",
    provider: "You.com",
    aiAgent: "YouChat",
    model: "you-search-ai",
    sourceType: "chat-referral",
    landingPage: "/boxes/marseille-08",
    query: "stockage marseille 8 securise",
    qualityScore: 74,
    intent: "transaction",
    answerPresence: "citation",
    estimatedClicks: 2,
    userAgent: "YouBot/1.0",
  },
  {
    id: "geo-evt-009",
    detectedAt: "2026-02-19T17:55:00.000Z",
    provider: "Perplexity",
    aiAgent: "Perplexity",
    model: "sonar-reasoning",
    sourceType: "assistant-browser",
    landingPage: "/help/payment",
    query: "frais retard paiement box stockage",
    qualityScore: 81,
    intent: "information",
    answerPresence: "citation",
    estimatedClicks: 1,
    userAgent: "PerplexityBot/2.0",
  },
  {
    id: "geo-evt-010",
    detectedAt: "2026-02-19T08:21:00.000Z",
    provider: "Google",
    aiAgent: "Google AI Overviews",
    model: "overview",
    sourceType: "assistant-browser",
    landingPage: "/centers/bordeaux",
    query: "garde meuble bordeaux court terme",
    qualityScore: 69,
    intent: "comparison",
    answerPresence: "mention",
    estimatedClicks: 1,
    userAgent: "GoogleOther",
  },
  {
    id: "geo-evt-011",
    detectedAt: "2026-02-18T14:03:00.000Z",
    provider: "Anthropic",
    aiAgent: "Claude",
    model: "claude-3.5-haiku",
    sourceType: "chat-referral",
    landingPage: "/blog/astuces-stockage",
    query: "conseils pour optimiser un box de stockage",
    qualityScore: 76,
    intent: "information",
    answerPresence: "citation",
    estimatedClicks: 2,
    userAgent: "ClaudeBot/1.0",
  },
  {
    id: "geo-evt-012",
    detectedAt: "2026-02-18T05:49:00.000Z",
    provider: "OpenAI",
    aiAgent: "ChatGPT",
    model: "gpt-4o-mini",
    sourceType: "assistant-browser",
    landingPage: "/booking/new",
    query: "réserver un box paris en ligne",
    qualityScore: 88,
    intent: "transaction",
    answerPresence: "citation",
    estimatedClicks: 4,
    userAgent: "ChatGPT-User/1.0",
  },
];

export interface GeoAiAgentAggregate {
  id: string;
  provider: string;
  aiAgent: string;
  models: string;
  visits: number;
  avgQualityScore: number;
  citationsRate: number;
  clickPotential: number;
}

export function getGeoAiEvents(): GeoAiEvent[] {
  return geoAiEvents;
}

export function getGeoAiAgentAggregates(): GeoAiAgentAggregate[] {
  const map = new Map<string, { provider: string; aiAgent: string; models: Set<string>; visits: number; quality: number; citations: number; clickPotential: number }>();

  geoAiEvents.forEach((event) => {
    const key = `${event.provider}:${event.aiAgent}`;
    if (!map.has(key)) {
      map.set(key, {
        provider: event.provider,
        aiAgent: event.aiAgent,
        models: new Set<string>(),
        visits: 0,
        quality: 0,
        citations: 0,
        clickPotential: 0,
      });
    }

    const current = map.get(key)!;
    current.models.add(event.model);
    current.visits += 1;
    current.quality += event.qualityScore;
    current.citations += event.answerPresence === "citation" ? 1 : 0;
    current.clickPotential += event.estimatedClicks;
  });

  return Array.from(map.entries())
    .map(([key, value]) => ({
      id: key,
      provider: value.provider,
      aiAgent: value.aiAgent,
      models: Array.from(value.models).join(", "),
      visits: value.visits,
      avgQualityScore: Math.round(value.quality / value.visits),
      citationsRate: Math.round((value.citations / value.visits) * 100),
      clickPotential: value.clickPotential,
    }))
    .sort((a, b) => b.visits - a.visits);
}

export function getGeoQualitySummary() {
  const visits = geoAiEvents.length;
  const distinctAgents = new Set(geoAiEvents.map((event) => `${event.provider}:${event.aiAgent}`)).size;
  const queryEvents = geoAiEvents.filter((event) => event.sourceType !== "crawler" && event.query.trim().length > 0);
  const avgQualityScore =
    queryEvents.length === 0
      ? 0
      : Math.round(
          queryEvents.reduce((acc, event) => acc + event.qualityScore, 0) /
            queryEvents.length
        );
  const highIntentShare =
    queryEvents.length === 0
      ? 0
      : Math.round(
          (queryEvents.filter((event) => event.intent === "transaction").length /
            queryEvents.length) *
            100
        );
  const citationCoverage =
    queryEvents.length === 0
      ? 0
      : Math.round(
          (queryEvents.filter((event) => event.answerPresence === "citation").length /
            queryEvents.length) *
            100
        );

  return {
    visits,
    distinctAgents,
    avgQualityScore,
    highIntentShare,
    citationCoverage,
  };
}