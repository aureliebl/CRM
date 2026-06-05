"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getConversationsByClient,
  getQuoteRequests,
  getUnfinishedBookings,
  getUnpaidInvoicesByClient,
} from "@/lib/mock/crm";
import { getClients } from "@/lib/mock/clients";
import { centers, boxTypes } from "@/lib/mock/centers-and-pricing";
import { TableWithColumnFilters } from "@/components/admin/TableWithColumnFilters";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { LeadSpiderChart, type SpiderAxis } from "@/components/admin/LeadSpiderChart";
import {
  buildDefaultLeadScoringConfig,
  concernLabel,
  concernToScore,
  getBudgetedLevelValue,
  getScoringPointsUsed,
  heatMeta,
  heatToScore,
  normalizeLeadScoringConfig,
  scoreFromLevel,
  weightedAverage,
  withUpdatedLevelCount,
  type LeadConcernKind,
  type LeadManualScoringInput,
  type LeadScoringAxisKey,
  type LeadScoringConfig,
  type LeadScoringPayload,
  type SalesHeatLevel,
} from "@/lib/lead-prioritization";
import { useLocale } from "@/lib/use-locale";
import { useRightPanel } from "@/components/admin/right-panel/RightPanelProvider";

type AcqTab = "unfinished" | "quotes" | "abandoned";
type ViewMode = "table" | "kanban";
type QuoteStatus = "new" | "sent" | "accepted" | "expired" | "abandoned";
type OperatorFilter = "all" | "unassigned" | string;

type OperatorAccount = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "operator";
  profileImage?: string | null;
};

type UnfinishedBookingRow = ReturnType<typeof getUnfinishedBookings>[number] & {
  centerName: string;
  boxTypeName: string;
  priceLabel: string;
  stoppedLabel: string;
  contactLabel: string;
  assignedOperatorId?: string;
};

type QuoteRow = ReturnType<typeof getQuoteRequests>[number] & {
  centerName: string;
  sizeLabel: string;
  createdLabel: string;
  sentLabel: string;
  statusLabel: string;
  assignedOperatorId?: string;
};

type AcquisitionBoardState = {
  unfinished: Record<string, { step?: number; assignedOperatorId?: string | null }>;
  quotes: Record<string, { status?: QuoteStatus; assignedOperatorId?: string | null }>;
  operatorAbsences: Record<string, string[]>;
  scoring?: LeadScoringPayload;
};

type LeadModalSelection =
  | { kind: "unfinished"; row: UnfinishedBookingRow }
  | { kind: "quote"; row: QuoteRow };

type LeadQuality = {
  label: string;
  score: number;
  bg: string;
  text: string;
};

type LeadConversationItem = {
  id: string;
  channel: "email" | "sms";
  direction: "inbound" | "outbound";
  content: string;
  timestamp: string;
};

type LeadPriorityPreview = {
  key: string;
  kind: "unfinished" | "quote";
  id: string;
  centerId: string;
  label: string;
  score: number;
  autoScore: number;
  rank: number;
  salesHeat: SalesHeatLevel;
  concernKind: LeadConcernKind;
  axisScores: Record<LeadScoringAxisKey, number>;
};

const STORAGE_KEY = "acquisition_settings_v1";
const DEFAULT_LEAD_SCORING_CONFIG = buildDefaultLeadScoringConfig(centers, boxTypes);

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = `${index + 1}`.padStart(2, "0");
    const monthPadded = `${month + 1}`.padStart(2, "0");
    return `${year}-${monthPadded}-${day}`;
  });
}

function getInitialUnfinishedRows() {
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));
  const btMap = Object.fromEntries(boxTypes.map((b) => [b.id, b]));
  return getUnfinishedBookings().map((ub) => ({
    ...ub,
    centerName: centerMap[ub.centerId]?.name ?? ub.centerId,
    boxTypeName: btMap[ub.boxTypeId]?.name ?? ub.boxTypeId,
    priceLabel: `${ub.price} €`,
    stoppedLabel: new Date(ub.stoppedAt).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    contactLabel: ub.fullName || ub.email || ub.phone || "—",
  }));
}

function getStatusLabel(status: QuoteStatus, fr: boolean) {
  if (status === "new") return fr ? "Nouveau" : "New";
  if (status === "sent") return fr ? "Envoyé" : "Sent";
  if (status === "accepted") return fr ? "Accepté" : "Accepted";
  if (status === "expired") return fr ? "Expiré" : "Expired";
  return fr ? "Abandonné" : "Abandoned";
}

function getInitialQuoteRows(fr: boolean): QuoteRow[] {
  const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));
  return getQuoteRequests().map((q) => {
    const normalizedStatus = (q.status || "new") as QuoteStatus;
    return {
      ...q,
      status: normalizedStatus,
      centerName: centerMap[q.centerId]?.name ?? q.centerId,
      sizeLabel: `${q.boxSizeWanted} m²`,
      createdLabel: new Date(q.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      sentLabel: q.sentAt ? new Date(q.sentAt).toLocaleDateString("fr-FR") : "—",
      statusLabel: getStatusLabel(normalizedStatus, fr),
    };
  });
}

function formatDateLabel(value: string, fr: boolean) {
  return new Date(value).toLocaleDateString(fr ? "fr-FR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeLabel(value: string, fr: boolean) {
  return new Date(value).toLocaleDateString(fr ? "fr-FR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveLeadClientId(selection: LeadModalSelection, quoteRows: QuoteRow[]): string | null {
  if (selection.kind === "quote" && selection.row.clientId) return selection.row.clientId;

  const email = String(selection.row.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) return null;

  const match = quoteRows.find(
    (quote) =>
      !!quote.clientId &&
      String(quote.email ?? "")
        .trim()
        .toLowerCase() === email
  );

  return match?.clientId ?? null;
}

function estimateDesiredMoveInDate(selection: LeadModalSelection): string {
  if (selection.kind === "quote") {
    return new Date(new Date(selection.row.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(new Date(selection.row.stoppedAt).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
}

function estimateLeadPrice(selection: LeadModalSelection): number | null {
  if (selection.kind === "unfinished") {
    return selection.row.price;
  }

  const row = selection.row;
  const candidates = boxTypes.filter((boxType) => boxType.centerId === row.centerId);
  if (candidates.length === 0) return null;

  const nearest = candidates.reduce((best, current) => {
    const bestDelta = Math.abs(best.sizeM2 - row.boxSizeWanted);
    const currentDelta = Math.abs(current.sizeM2 - row.boxSizeWanted);
    return currentDelta < bestDelta ? current : best;
  }, candidates[0]);

  return nearest.basePrice;
}

function pickNearestBoxTypeForCenter(centerId: string, desiredSizeM2: number) {
  const candidates = boxTypes.filter((boxType) => boxType.centerId === centerId);
  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) => {
    const bestDelta = Math.abs(best.sizeM2 - desiredSizeM2);
    const candidateDelta = Math.abs(candidate.sizeM2 - desiredSizeM2);
    return candidateDelta < bestDelta ? candidate : best;
  }, candidates[0]);
}

function computeLeadQuality(selection: LeadModalSelection, unpaidCount: number, hasConversations: boolean, fr: boolean): LeadQuality {
  let score = 42;

  if (selection.row.fullName) score += 10;
  if (selection.row.email) score += 9;
  if (selection.row.phone) score += 9;
  if (hasConversations) score += 8;

  if (selection.kind === "unfinished") {
    const row = selection.row;
    const progressRatio = row.totalSteps > 0 ? row.step / row.totalSteps : 0;
    score += Math.round(progressRatio * 20);
    if (row.source === "landing-page" || row.source === "google-ads") score += 6;
    if (row.source === "parrainage") score += 9;
  } else {
    const row = selection.row;
    if (row.status === "accepted") score += 18;
    else if (row.status === "sent") score += 11;
    else if (row.status === "new") score += 8;
    else if (row.status === "expired") score -= 5;
    else if (row.status === "abandoned") score -= 10;

    if (row.message) score += 6;
  }

  if (selection.row.assignedOperatorId) score += 5;
  if (unpaidCount > 0) score -= Math.min(25, unpaidCount * 10);

  const normalized = Math.max(0, Math.min(100, score));
  if (normalized >= 75) {
    return {
      label: fr ? "Très chaud" : "Hot",
      score: normalized,
      bg: "rgba(16,185,129,0.18)",
      text: "#047857",
    };
  }
  if (normalized >= 50) {
    return {
      label: fr ? "Qualifié" : "Qualified",
      score: normalized,
      bg: "rgba(59,130,246,0.16)",
      text: "#1d4ed8",
    };
  }
  if (normalized >= 30) {
    return {
      label: fr ? "Tiède" : "Warm",
      score: normalized,
      bg: "rgba(245,158,11,0.18)",
      text: "#b45309",
    };
  }

  return {
    label: fr ? "Froid" : "Cold",
    score: normalized,
    bg: "rgba(239,68,68,0.16)",
    text: "#b91c1c",
  };
}

function buildFallbackConversations(selection: LeadModalSelection, fr: boolean): LeadConversationItem[] {
  const baseTimestamp =
    selection.kind === "quote" ? selection.row.createdAt : selection.row.stoppedAt;
  const outboundIntro =
    selection.kind === "quote"
      ? fr
        ? "Bonjour, nous avons bien reçu votre demande de devis."
        : "Hello, we have received your quote request."
      : fr
      ? "Nous avons vu que votre réservation a été interrompue. Souhaitez-vous reprendre ?"
      : "We noticed your booking was interrupted. Would you like to resume?";

  const inboundReply =
    selection.kind === "quote"
      ? selection.row.message || (fr ? "Merci, je suis intéressé." : "Thanks, I am interested.")
      : fr
      ? `Je cherche un box autour de ${selection.row.price} €.`
      : `I am looking for a box around ${selection.row.price} €.`;

  return [
    {
      id: `${selection.row.id}_fallback_out`,
      channel: "email",
      direction: "outbound",
      content: outboundIntro,
      timestamp: baseTimestamp,
    },
    {
      id: `${selection.row.id}_fallback_in`,
      channel: "email",
      direction: "inbound",
      content: inboundReply,
      timestamp: new Date(new Date(baseTimestamp).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getLeadPriorityKey(kind: "unfinished" | "quote", id: string): string {
  return `${kind}:${id}`;
}

function getDefaultConcernKindFromSegment(segment?: string): LeadConcernKind {
  if (segment === "B2B") return "company";
  return "self";
}

function estimateStartDateUrgencyScore(startDateIso: string): number {
  const now = Date.now();
  const dateValue = new Date(startDateIso).getTime();
  if (!Number.isFinite(dateValue)) return 50;

  const diffDays = Math.ceil((dateValue - now) / (24 * 60 * 60 * 1000));
  if (diffDays <= 3) return 100;
  if (diffDays <= 7) return 86;
  if (diffDays <= 14) return 68;
  if (diffDays <= 30) return 48;
  return 30;
}

function getPreferredBoxTypeIdForQuote(row: QuoteRow): string | null {
  const nearest = pickNearestBoxTypeForCenter(row.centerId, row.boxSizeWanted);
  return nearest?.id ?? null;
}

function scoreToCardTone(score: number): { bg: string; text: string } {
  if (score >= 80) {
    return {
      bg: "rgba(16,185,129,0.16)",
      text: "#047857",
    };
  }
  if (score >= 60) {
    return {
      bg: "rgba(37,99,235,0.16)",
      text: "#1d4ed8",
    };
  }
  if (score >= 40) {
    return {
      bg: "rgba(249,115,22,0.16)",
      text: "#c2410c",
    };
  }
  return {
    bg: "rgba(239,68,68,0.16)",
    text: "#b91c1c",
  };
}

function autoAssignRows<T extends { assignedOperatorId?: string }>(
  current: T[],
  availableOperators: OperatorAccount[],
  cursorRef: { current: number },
): T[] {
  const loads = new Map<string, number>();
  availableOperators.forEach((operator) => loads.set(operator.id, 0));

  let didChange = false;
  const normalized = current.map((row) => {
    if (!row.assignedOperatorId) return row;
    didChange = true;
    return { ...row, assignedOperatorId: undefined };
  });

  if (availableOperators.length === 0) {
    return didChange ? normalized : current;
  }

  const cursor = cursorRef.current % availableOperators.length;
  const rotated = [...availableOperators.slice(cursor), ...availableOperators.slice(0, cursor)];

  let assignedCount = 0;
  const next = normalized.map((row) => {
    if (row.assignedOperatorId) return row;

    let chosen = rotated[0];
    for (const candidate of rotated) {
      if ((loads.get(candidate.id) || 0) < (loads.get(chosen.id) || 0)) {
        chosen = candidate;
      }
    }

    loads.set(chosen.id, (loads.get(chosen.id) || 0) + 1);
    assignedCount += 1;
    didChange = true;
    return { ...row, assignedOperatorId: chosen.id };
  });

  if (!didChange) return current;

  if (assignedCount > 0) {
    cursorRef.current = (cursorRef.current + assignedCount) % availableOperators.length;
  }
  return next;
}

export default function AcquisitionPage() {
  const { locale } = useLocale();
  const { openPanel } = useRightPanel();
  const fr = locale === "fr";
  const [activeTab, setActiveTab] = useState<AcqTab>("unfinished");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [unfinishedRows, setUnfinishedRows] = useState<UnfinishedBookingRow[]>(() =>
    getInitialUnfinishedRows()
  );
  const [quoteRows, setQuoteRows] = useState<QuoteRow[]>(() => getInitialQuoteRows(fr));
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const [operatorAbsences, setOperatorAbsences] = useState<Record<string, string[]>>({});
  const [presenceModalOpen, setPresenceModalOpen] = useState(false);
  const [presenceMonth, setPresenceMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState<OperatorFilter>("all");
  const [boardReady, setBoardReady] = useState(false);
  const [leadModalSelection, setLeadModalSelection] = useState<LeadModalSelection | null>(null);
  const [prioritizationModalOpen, setPrioritizationModalOpen] = useState(false);
  const [leadScoringConfig, setLeadScoringConfig] = useState<LeadScoringConfig>(
    () => DEFAULT_LEAD_SCORING_CONFIG
  );
  const [leadManualScoringByKey, setLeadManualScoringByKey] = useState<
    Record<string, LeadManualScoringInput>
  >({});
  const balanceCursorRef = useRef(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        viewMode?: ViewMode;
        autoAssignEnabled?: boolean;
      };

      if (parsed.viewMode === "kanban" || parsed.viewMode === "table") {
        setViewMode(parsed.viewMode);
      }
      if (typeof parsed.autoAssignEnabled === "boolean") {
        setAutoAssignEnabled(parsed.autoAssignEnabled);
      }
    } catch {
      // Ignore localStorage parsing issues.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        viewMode,
        autoAssignEnabled,
      })
    );
  }, [viewMode, autoAssignEnabled]);

  useEffect(() => {
    setQuoteRows(getInitialQuoteRows(fr));
  }, [fr]);

  useEffect(() => {
    let mounted = true;

    const applySharedState = (payload: AcquisitionBoardState) => {
      setUnfinishedRows((current) =>
        current.map((row) => {
          const override = payload.unfinished[row.id];
          if (!override) return row;
          return {
            ...row,
            step:
              typeof override.step === "number"
                ? Math.max(1, Math.min(override.step, row.totalSteps))
                : row.step,
            assignedOperatorId: override.assignedOperatorId ?? undefined,
          };
        })
      );

      setQuoteRows((current) =>
        current.map((row) => {
          const override = payload.quotes[row.id];
          if (!override) return row;
          const status = (override.status ?? row.status) as QuoteStatus;
          return {
            ...row,
            status,
            statusLabel: getStatusLabel(status, fr),
            assignedOperatorId: override.assignedOperatorId ?? undefined,
          };
        })
      );

      setOperatorAbsences(payload.operatorAbsences || {});

      if (payload.scoring?.config) {
        setLeadScoringConfig(
          normalizeLeadScoringConfig(payload.scoring.config, centers, boxTypes)
        );
      }
      if (payload.scoring?.manualByLead && typeof payload.scoring.manualByLead === "object") {
        setLeadManualScoringByKey(payload.scoring.manualByLead);
      }
    };

    const loadBoard = async () => {
      try {
        const res = await fetch("/api/acquisition/board", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const payload = (await res.json()) as AcquisitionBoardState;
        if (!mounted) return;
        applySharedState(payload);
      } finally {
        if (mounted) setBoardReady(true);
      }
    };

    void loadBoard();
    const interval = window.setInterval(() => {
      void loadBoard();
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [fr]);

  useEffect(() => {
    if (!boardReady) return;

    const unfinished: AcquisitionBoardState["unfinished"] = {};
    unfinishedRows.forEach((row) => {
      unfinished[row.id] = {
        step: row.step,
        assignedOperatorId: row.assignedOperatorId ?? null,
      };
    });

    const quotes: AcquisitionBoardState["quotes"] = {};
    quoteRows.forEach((row) => {
      quotes[row.id] = {
        status: row.status as QuoteStatus,
        assignedOperatorId: row.assignedOperatorId ?? null,
      };
    });

    const timeout = window.setTimeout(() => {
      void fetch("/api/acquisition/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unfinished,
          quotes,
          operatorAbsences,
          scoring: {
            config: leadScoringConfig,
            manualByLead: leadManualScoringByKey,
          },
        } satisfies AcquisitionBoardState),
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [
    boardReady,
    unfinishedRows,
    quoteRows,
    operatorAbsences,
    leadScoringConfig,
    leadManualScoringByKey,
  ]);

  useEffect(() => {
    let mounted = true;
    const loadOperators = async () => {
      setOperatorsLoading(true);
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const payload = (await res.json()) as OperatorAccount[];
        if (!mounted) return;
        const filtered = payload.filter((item) => item.role === "operator");
        setOperators(filtered);
      } finally {
        if (mounted) setOperatorsLoading(false);
      }
    };

    void loadOperators();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedOperatorId && operators.length > 0) {
      setSelectedOperatorId(operators[0].id);
    }
    if (selectedOperatorId && operators.length > 0 && !operators.some((operator) => operator.id === selectedOperatorId)) {
      setSelectedOperatorId(operators[0].id);
    }
  }, [operators, selectedOperatorId]);

  useEffect(() => {
    if (!autoAssignEnabled || operators.length === 0) return;

    const todayKey = getTodayKey();
    const availableOperators = operators.filter(
      (operator) => !operatorAbsences[operator.id]?.includes(todayKey)
    );

    setUnfinishedRows((current) =>
      autoAssignRows(current, availableOperators, balanceCursorRef)
    );

    setQuoteRows((current) =>
      autoAssignRows(current, availableOperators, balanceCursorRef)
    );
  }, [autoAssignEnabled, operators, operatorAbsences]);

  const operatorById = useMemo(() => {
    const map = new Map<string, OperatorAccount>();
    operators.forEach((operator) => map.set(operator.id, operator));
    return map;
  }, [operators]);

  const monthDays = useMemo(() => getMonthDays(presenceMonth), [presenceMonth]);
  const selectedOperatorAbsences = selectedOperatorId
    ? operatorAbsences[selectedOperatorId] || []
    : [];

  const clientsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getClients>[number]>();
    for (const client of getClients()) {
      map.set(client.id, client);
    }
    return map;
  }, []);

  const leadPriorityState = useMemo(() => {
    const unfinished: Record<string, LeadPriorityPreview> = {};
    const quotes: Record<string, LeadPriorityPreview> = {};

    const quoteClientByEmail = new Map<string, string>();
    for (const row of quoteRows) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (email && row.clientId) {
        quoteClientByEmail.set(email, row.clientId);
      }
    }

    const inferConcernFromName = (fullName?: string) => {
      const value = String(fullName ?? "").toLowerCase();
      if (/(sarl|sas|sci|societe|company|inc|corp)/.test(value)) {
        return "company" as LeadConcernKind;
      }
      return "self" as LeadConcernKind;
    };

    const buildPreview = ({
      key,
      kind,
      id,
      centerId,
      label,
      boxTypeId,
      startDate,
      contactCount,
      unpaidCount,
      concernKind,
      salesHeat,
    }: {
      key: string;
      kind: "unfinished" | "quote";
      id: string;
      centerId: string;
      label: string;
      boxTypeId: string | null;
      startDate: string;
      contactCount: number;
      unpaidCount: number;
      concernKind: LeadConcernKind;
      salesHeat: SalesHeatLevel;
    }): LeadPriorityPreview => {
      const centerLevel = leadScoringConfig.centerPriorityLevels[centerId] ?? 0;
      const boxLevel =
        boxTypeId && leadScoringConfig.boxTypePriorityLevelsByCenter[centerId]
          ? leadScoringConfig.boxTypePriorityLevelsByCenter[centerId][boxTypeId] ?? 0
          : 0;

      const axisScores: Record<LeadScoringAxisKey, number> = {
        centerPriority: scoreFromLevel(centerLevel, leadScoringConfig.levelCount),
        boxSizePriority: scoreFromLevel(boxLevel, leadScoringConfig.levelCount),
        startDateUrgency: estimateStartDateUrgencyScore(startDate),
        concernPriority: concernToScore(concernKind),
        contactCompleteness: Math.round((contactCount / 3) * 100),
        unpaidRisk: Math.max(0, 100 - unpaidCount * 35),
        salesHeat: heatToScore(salesHeat),
      };

      const autoScore = weightedAverage([
        {
          score: axisScores.centerPriority,
          weight: leadScoringConfig.axisWeights.centerPriority,
        },
        {
          score: axisScores.boxSizePriority,
          weight: leadScoringConfig.axisWeights.boxSizePriority,
        },
        {
          score: axisScores.startDateUrgency,
          weight: leadScoringConfig.axisWeights.startDateUrgency,
        },
        {
          score: axisScores.concernPriority,
          weight: leadScoringConfig.axisWeights.concernPriority,
        },
        {
          score: axisScores.contactCompleteness,
          weight: leadScoringConfig.axisWeights.contactCompleteness,
        },
        {
          score: axisScores.unpaidRisk,
          weight: leadScoringConfig.axisWeights.unpaidRisk,
        },
      ]);

      const totalScore = weightedAverage([
        {
          score: axisScores.centerPriority,
          weight: leadScoringConfig.axisWeights.centerPriority,
        },
        {
          score: axisScores.boxSizePriority,
          weight: leadScoringConfig.axisWeights.boxSizePriority,
        },
        {
          score: axisScores.startDateUrgency,
          weight: leadScoringConfig.axisWeights.startDateUrgency,
        },
        {
          score: axisScores.concernPriority,
          weight: leadScoringConfig.axisWeights.concernPriority,
        },
        {
          score: axisScores.contactCompleteness,
          weight: leadScoringConfig.axisWeights.contactCompleteness,
        },
        {
          score: axisScores.unpaidRisk,
          weight: leadScoringConfig.axisWeights.unpaidRisk,
        },
        {
          score: axisScores.salesHeat,
          weight: leadScoringConfig.axisWeights.salesHeat,
        },
      ]);

      return {
        key,
        kind,
        id,
        centerId,
        label,
        score: totalScore,
        autoScore,
        rank: 1,
        salesHeat,
        concernKind,
        axisScores,
      };
    };

    for (const row of unfinishedRows) {
      const key = getLeadPriorityKey("unfinished", row.id);
      const manual = leadManualScoringByKey[key] ?? {};
      const fallbackClientId = quoteClientByEmail.get(String(row.email ?? "").trim().toLowerCase());
      const client = fallbackClientId ? clientsById.get(fallbackClientId) : undefined;
      const concernKind =
        manual.concernKind ??
        (client ? getDefaultConcernKindFromSegment(client.segment) : inferConcernFromName(row.fullName));
      const salesHeat = manual.salesHeat ?? "warm";
      const startDate = estimateDesiredMoveInDate({ kind: "unfinished", row });
      const contactCount = [row.fullName, row.email, row.phone].filter(Boolean).length;
      const unpaidCount = fallbackClientId ? getUnpaidInvoicesByClient(fallbackClientId).length : 0;

      unfinished[row.id] = buildPreview({
        key,
        kind: "unfinished",
        id: row.id,
        centerId: row.centerId,
        label: row.contactLabel,
        boxTypeId: row.boxTypeId,
        startDate,
        contactCount,
        unpaidCount,
        concernKind,
        salesHeat,
      });
    }

    for (const row of quoteRows) {
      const key = getLeadPriorityKey("quote", row.id);
      const manual = leadManualScoringByKey[key] ?? {};
      const client = row.clientId ? clientsById.get(row.clientId) : undefined;
      const concernKind =
        manual.concernKind ??
        (client ? getDefaultConcernKindFromSegment(client.segment) : inferConcernFromName(row.fullName));
      const salesHeat = manual.salesHeat ?? "warm";
      const startDate = estimateDesiredMoveInDate({ kind: "quote", row });
      const contactCount = [row.fullName, row.email, row.phone].filter(Boolean).length;
      const unpaidCount = row.clientId ? getUnpaidInvoicesByClient(row.clientId).length : 0;

      quotes[row.id] = buildPreview({
        key,
        kind: "quote",
        id: row.id,
        centerId: row.centerId,
        label: row.fullName || row.email || row.phone || "—",
        boxTypeId: getPreferredBoxTypeIdForQuote(row),
        startDate,
        contactCount,
        unpaidCount,
        concernKind,
        salesHeat,
      });
    }

    const assignRanks = <T extends { id: string }>(
      rows: T[],
      groupBy: (row: T) => string,
      mapById: Record<string, LeadPriorityPreview>
    ) => {
      const groups = new Map<string, LeadPriorityPreview[]>();

      for (const row of rows) {
        const preview = mapById[row.id];
        if (!preview) continue;
        const bucketKey = groupBy(row);
        if (!groups.has(bucketKey)) {
          groups.set(bucketKey, []);
        }
        groups.get(bucketKey)?.push(preview);
      }

      groups.forEach((items) => {
        items
          .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
          .forEach((item, index) => {
            item.rank = index + 1;
          });
      });
    };

    assignRanks(unfinishedRows, (row) => `unfinished:${row.step}`, unfinished);
    assignRanks(quoteRows, (row) => `quote:${row.status}`, quotes);

    const all = [...Object.values(unfinished), ...Object.values(quotes)].sort(
      (left, right) => right.score - left.score || left.id.localeCompare(right.id)
    );

    return {
      unfinished,
      quotes,
      all,
    };
  }, [
    unfinishedRows,
    quoteRows,
    leadScoringConfig,
    leadManualScoringByKey,
    clientsById,
  ]);

  const toggleAbsenceDay = (operatorId: string, day: string) => {
    setOperatorAbsences((current) => {
      const days = current[operatorId] || [];
      const exists = days.includes(day);
      const nextDays = exists ? days.filter((item) => item !== day) : [...days, day];
      return {
        ...current,
        [operatorId]: nextDays,
      };
    });
  };

  const tabs: { key: AcqTab; label: string; icon: string }[] = [
    { key: "unfinished", label: fr ? "Bookings non finalisés" : "Unfinished Bookings", icon: "pending_actions" },
    { key: "quotes", label: fr ? "Demandes de devis" : "Quote Requests", icon: "request_quote" },
    { key: "abandoned", label: fr ? "Devis non finalisés" : "Abandoned Quotes", icon: "cancel" },
  ];

  return (
    <div>
      <h1 className="admin-page-title">{fr ? "Lead" : "Lead"}</h1>
      <p className="admin-page-description">
        {fr
          ? "Suivi des leads en acquisition : bookings interrompus, demandes de devis et devis abandonnés."
          : "Lead acquisition tracking: interrupted bookings, quote requests, and abandoned quotes."}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
          <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => setPresenceModalOpen(true)}
          style={{ padding: "0.3rem 0.6rem", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <MaterialSymbol name="calendar_month" style={{ fontSize: 15 }} />
          {fr ? "Absences" : "Absences"}
        </button>

        <select
          value={operatorFilter}
          onChange={(event) => setOperatorFilter(event.target.value)}
          style={{
            padding: "0.3rem 0.55rem",
            borderRadius: "0.45rem",
            border: "1px solid var(--border-color)",
            background: "var(--input-bg)",
            color: "var(--text-primary)",
            fontSize: 12,
          }}
        >
          <option value="all">{fr ? "Tous les opérateurs" : "All operators"}</option>
          <option value="unassigned">{fr ? "Non attribués" : "Unassigned"}</option>
          {operators.map((operator) => (
            <option key={`filter_op_${operator.id}`} value={operator.id}>
              {operator.fullName || operator.email}
            </option>
          ))}
        </select>

        <div style={{ display: "inline-flex", border: "1px solid var(--border-color)", borderRadius: 999, padding: 2 }}>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className="admin-btn"
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 999,
              background: viewMode === "table" ? "var(--accent-primary)" : "transparent",
              color: viewMode === "table" ? "#fff" : "var(--text-secondary)",
              border: "none",
              fontSize: 12,
            }}
          >
            {fr ? "Tableau" : "Table"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className="admin-btn"
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 999,
              background: viewMode === "kanban" ? "var(--accent-primary)" : "transparent",
              color: viewMode === "kanban" ? "#fff" : "var(--text-secondary)",
              border: "none",
              fontSize: 12,
            }}
          >
            Kanban
          </button>
        </div>

        {viewMode === "kanban" ? (
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => setPrioritizationModalOpen(true)}
            style={{
              padding: "0.3rem 0.6rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MaterialSymbol name="tune" style={{ fontSize: 15 }} />
            {fr ? "Priorisation" : "Prioritization"}
          </button>
        ) : null}

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {fr ? "Attribution auto" : "Auto assign"}
          </span>
          <span
            style={{
              position: "relative",
              width: 42,
              height: 24,
              background: autoAssignEnabled ? "#34c759" : "#d1d5db",
              borderRadius: 999,
              transition: "background 0.2s ease",
            }}
          >
            <input
              type="checkbox"
              checked={autoAssignEnabled}
              onChange={(event) => setAutoAssignEnabled(event.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
            />
            <span
              style={{
                position: "absolute",
                top: 2,
                left: autoAssignEnabled ? 20 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                transition: "left 0.2s ease",
              }}
            />
          </span>
        </label>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "2px solid var(--border-primary)",
        marginBottom: 20,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent-primary)" : "2px solid transparent",
              marginBottom: -2,
              color: activeTab === tab.key ? "var(--accent-primary)" : "var(--text-secondary)",
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            <MaterialSymbol name={tab.icon} style={{ fontSize: 18 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "unfinished" && (
        <UnfinishedBookingsTab
          fr={fr}
          rows={unfinishedRows}
          setRows={setUnfinishedRows}
          viewMode={viewMode}
          operatorFilter={operatorFilter}
          operators={operators}
          operatorById={operatorById}
          priorityById={leadPriorityState.unfinished}
          operatorsLoading={operatorsLoading}
          onOpenDetails={(row) =>
            openPanel({
              panelId: "acquisition.unfinishedBooking",
              contextKey: "acquisition.unfinished",
              entity: row,
            })
          }
          onOpenLeadModal={(row) => setLeadModalSelection({ kind: "unfinished", row })}
        />
      )}
      {activeTab === "quotes" && (
        <QuoteRequestsTab
          fr={fr}
          rows={quoteRows}
          setRows={setQuoteRows}
          viewMode={viewMode}
          operatorFilter={operatorFilter}
          priorityById={leadPriorityState.quotes}
          onOpenDetails={(row) =>
            openPanel({
              panelId: "acquisition.quoteRequest",
              contextKey: "acquisition.quotes",
              entity: row,
            })
          }
          onOpenLeadModal={(row) => setLeadModalSelection({ kind: "quote", row })}
        />
      )}
      {activeTab === "abandoned" && (
        <AbandonedQuotesTab
          fr={fr}
          rows={quoteRows}
          setRows={setQuoteRows}
          viewMode={viewMode}
          operatorFilter={operatorFilter}
          priorityById={leadPriorityState.quotes}
          onOpenDetails={(row) =>
            openPanel({
              panelId: "acquisition.quoteRequest",
              contextKey: "acquisition.abandoned",
              entity: row,
            })
          }
          onOpenLeadModal={(row) => setLeadModalSelection({ kind: "quote", row })}
        />
      )}

      {leadModalSelection && (
        <LeadKanbanDetailsModal
          key={`${leadModalSelection.kind}:${leadModalSelection.row.id}`}
          fr={fr}
          selection={leadModalSelection}
          operatorById={operatorById}
          quoteRows={quoteRows}
          onClose={() => setLeadModalSelection(null)}
        />
      )}

      {prioritizationModalOpen ? (
        <LeadPrioritizationModal
          fr={fr}
          onClose={() => setPrioritizationModalOpen(false)}
          scoringConfig={leadScoringConfig}
          setScoringConfig={setLeadScoringConfig}
          manualByLead={leadManualScoringByKey}
          setManualByLead={setLeadManualScoringByKey}
          priorities={leadPriorityState.all}
        />
      ) : null}

      {presenceModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 90,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(820px, 100%)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: "0.9rem",
              display: "grid",
              gap: "0.8rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fr ? "Calendrier des absences" : "Absence calendar"}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {fr
                    ? "Clique sur un jour pour marquer un opérateur absent (non assignable)."
                    : "Click a day to mark an operator as unavailable (not assignable)."}
                </div>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setPresenceModalOpen(false)}
              >
                {fr ? "Fermer" : "Close"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {operators.map((operator) => {
                const active = selectedOperatorId === operator.id;
                return (
                  <button
                    key={`presence_op_${operator.id}`}
                    type="button"
                    className="admin-btn"
                    onClick={() => setSelectedOperatorId(operator.id)}
                    style={{
                      borderRadius: 999,
                      padding: "0.35rem 0.7rem",
                      border: "1px solid var(--border-color)",
                      background: active ? "var(--accent-primary)" : "transparent",
                      color: active ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {operator.fullName || operator.email}
                  </button>
                );
              })}
              {operators.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {fr ? "Aucun opérateur chargé." : "No operators loaded."}
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() =>
                  setPresenceMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
              >
                <MaterialSymbol name="chevron_left" style={{ fontSize: 16 }} />
              </button>
              <strong>
                {presenceMonth.toLocaleDateString(fr ? "fr-FR" : "en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() =>
                  setPresenceMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
              >
                <MaterialSymbol name="chevron_right" style={{ fontSize: 16 }} />
              </button>
            </div>

            {selectedOperatorId ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: "0.35rem",
                }}
              >
                {monthDays.map((day) => {
                  const absent = selectedOperatorAbsences.includes(day);
                  const dayDate = new Date(`${day}T00:00:00`);
                  const isToday = day === getTodayKey();
                  const isCurrentMonth = getMonthKey(dayDate) === getMonthKey(presenceMonth);
                  if (!isCurrentMonth) return null;

                  return (
                    <button
                      key={`day_${day}`}
                      type="button"
                      onClick={() => toggleAbsenceDay(selectedOperatorId, day)}
                      className="admin-btn"
                      style={{
                        border: `1px solid ${absent ? "#ef4444" : "var(--border-color)"}`,
                        background: absent ? "#fee2e2" : "transparent",
                        color: absent ? "#991b1b" : "var(--text-primary)",
                        borderRadius: 8,
                        padding: "0.45rem 0.25rem",
                        fontSize: 12,
                        position: "relative",
                      }}
                    >
                      {dayDate.getDate()}
                      {isToday && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 5,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--accent-primary)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {fr
                ? "Règle d'auto-attribution: uniquement opérateurs disponibles aujourd'hui, avec équilibrage de charge."
                : "Auto-assignment rule: available operators only today, with load balancing."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// UNFINISHED BOOKINGS
// ──────────────────────────────────────────

function UnfinishedBookingsTab({
  fr,
  rows,
  setRows,
  viewMode,
  operatorFilter,
  operators,
  operatorById,
  priorityById,
  operatorsLoading,
  onOpenDetails,
  onOpenLeadModal,
}: {
  fr: boolean;
  rows: UnfinishedBookingRow[];
  setRows: React.Dispatch<React.SetStateAction<UnfinishedBookingRow[]>>;
  viewMode: ViewMode;
  operatorFilter: OperatorFilter;
  operators: OperatorAccount[];
  operatorById: Map<string, OperatorAccount>;
  priorityById: Record<string, LeadPriorityPreview>;
  operatorsLoading: boolean;
  onOpenDetails: (row: UnfinishedBookingRow) => void;
  onOpenLeadModal: (row: UnfinishedBookingRow) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openAssignMenuId, setOpenAssignMenuId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
  const pointerRef = useRef<{ cardId: string; x: number; y: number; moved: boolean } | null>(null);

  const maxStep = useMemo(() => {
    return Math.max(1, ...rows.map((row) => row.totalSteps));
  }, [rows]);

  const columns = useMemo(() => {
    return Array.from({ length: maxStep }, (_, index) => index + 1);
  }, [maxStep]);

  const visibleRows = useMemo(() => {
    if (operatorFilter === "all") return rows;
    if (operatorFilter === "unassigned") return rows.filter((row) => !row.assignedOperatorId);
    return rows.filter((row) => row.assignedOperatorId === operatorFilter);
  }, [rows, operatorFilter]);

  const assignOperator = (leadId: string, operatorId: string | null) => {
    setRows((current) =>
      current.map((row) =>
        row.id === leadId ? { ...row, assignedOperatorId: operatorId ?? undefined } : row
      )
    );
    setOpenAssignMenuId(null);
  };

  const moveToStep = (leadId: string, nextStep: number) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === leadId);
      if (!moving) return current;

      const without = current.filter((row) => row.id !== leadId);
      const next = {
        ...moving,
        step: Math.max(1, Math.min(nextStep, moving.totalSteps)),
      };

      const lastIndexInColumn = without.reduce((acc, row, index) => (row.step === next.step ? index : acc), -1);
      const insertIndex = lastIndexInColumn >= 0 ? lastIndexInColumn + 1 : without.length;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  const moveBeforeOrAfter = (leadId: string, targetId: string, side: "before" | "after", step: number) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === leadId);
      if (!moving) return current;

      const without = current.filter((row) => row.id !== leadId);
      const targetIndex = without.findIndex((row) => row.id === targetId);
      if (targetIndex < 0) return current;

      const next = {
        ...moving,
        step: Math.max(1, Math.min(step, moving.totalSteps)),
      };

      const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  if (viewMode === "kanban") {
    return (
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {fr
            ? "Déplace un ticket entre colonnes pour mettre à jour son étape."
            : "Drag a ticket between columns to update its step."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.3rem",
          }}
        >
          {columns.map((step) => {
            const stepRows = visibleRows
              .filter((row) => row.step === step)
              .slice()
              .sort((left, right) => {
                const leftScore = priorityById[left.id]?.score ?? 0;
                const rightScore = priorityById[right.id]?.score ?? 0;
                return rightScore - leftScore || left.id.localeCompare(right.id);
              });

            return (
              <div
                key={`step_${step}`}
                onDragOver={(event) => { event.preventDefault(); setDragOverColumn(step); }}
                onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStep(draggingId, step);
                  setDraggingId(null);
                  setDragOverColumn(null);
                  setDragOverCardId(null);
                }}
                style={{
                  border: dragOverColumn === step ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: dragOverColumn === step ? "rgba(99,102,241,0.05)" : "var(--card-bg)",
                  minHeight: 280,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  transition: "border-color 0.12s, background 0.12s",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    padding: "0.55rem 0.7rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {fr ? `Étape ${step}` : `Step ${step}`}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stepRows.length}</span>
                </div>

                <div style={{ padding: "0.55rem", display: "grid", gap: "0.45rem", alignContent: "start" }}>
                  {stepRows.map((row) => {
                    const assigned = row.assignedOperatorId
                      ? operatorById.get(row.assignedOperatorId)
                      : undefined;
                    const priority = priorityById[row.id];
                    const heat = priority ? heatMeta(priority.salesHeat, fr) : null;
                    const tone = priority ? scoreToCardTone(priority.score) : null;
                    const insertBefore = draggingId && dragOverCardId === row.id && dragInsertSide === "before";
                    const insertAfter = draggingId && dragOverCardId === row.id && dragInsertSide === "after";

                    return (
                      <div key={row.id} style={{ display: "grid", gap: 4 }}>
                        {insertBefore ? <div className="kanban-insert-line" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingId(row.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverColumn(null);
                            setDragOverCardId(null);
                            pointerRef.current = null;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const nextSide = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            if (dragOverCardId !== row.id) setDragOverCardId(row.id);
                            if (dragInsertSide !== nextSide) setDragInsertSide(nextSide);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingId || draggingId === row.id) return;
                            moveBeforeOrAfter(draggingId, row.id, dragInsertSide, step);
                            setDraggingId(null);
                            setDragOverCardId(null);
                            setDragOverColumn(null);
                          }}
                          onMouseDown={(event) => {
                            pointerRef.current = { cardId: row.id, x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onMouseMove={(event) => {
                            if (!pointerRef.current || pointerRef.current.cardId !== row.id) return;
                            const dx = event.clientX - pointerRef.current.x;
                            const dy = event.clientY - pointerRef.current.y;
                            if (Math.hypot(dx, dy) > 6) {
                              pointerRef.current.moved = true;
                            }
                          }}
                          onMouseUp={(event) => {
                            const pointer = pointerRef.current;
                            pointerRef.current = null;
                            if (!pointer || pointer.cardId !== row.id || pointer.moved) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest("button, a, input, select, textarea")) return;
                            onOpenLeadModal(row);
                          }}
                          onMouseEnter={() => setHoveredCardId(row.id)}
                          onMouseLeave={() => setHoveredCardId(null)}
                          className="ui-hover-premium"
                          style={{
                            border: hoveredCardId === row.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                            borderRadius: 8,
                            background:
                              hoveredCardId === row.id
                                ? "var(--surface-secondary, rgba(255,255,255,0.06))"
                                : "var(--surface-secondary, rgba(255,255,255,0.02))",
                            padding: "0.5rem",
                            cursor: draggingId === row.id ? "grabbing" : "grab",
                            display: "grid",
                            gap: "0.35rem",
                            position: "relative",
                            opacity: draggingId === row.id ? 0 : 1,
                          }}
                        >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.contactLabel}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.centerName}
                            </div>
                            {priority ? (
                              <div style={{ display: "inline-flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    borderRadius: 999,
                                    padding: "2px 7px",
                                    background: tone?.bg,
                                    color: tone?.text,
                                    fontWeight: 700,
                                  }}
                                >
                                  #{priority.rank} • {priority.score}
                                </span>
                                {heat ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      borderRadius: 999,
                                      padding: "2px 7px",
                                      background: heat.bg,
                                      color: heat.text,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {heat.label}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setOpenAssignMenuId((current) => (current === row.id ? null : row.id)); }}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              <MaterialSymbol name="more_horiz" size={16} weight={500} opticalSize={20} />
                            </button>

                            {openAssignMenuId === row.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "110%",
                                  zIndex: 20,
                                  minWidth: 210,
                                  border: "1px solid var(--border-color)",
                                  borderRadius: 8,
                                  background: "var(--card-bg)",
                                  padding: "0.35rem",
                                  boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
                                  display: "grid",
                                  gap: "0.15rem",
                                }}
                              >
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", padding: "0.2rem 0.35rem" }}>
                                  {fr ? "Attribuer à" : "Assign to"}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); assignOperator(row.id, null); }}
                                  className="admin-btn admin-btn-secondary"
                                  style={{ justifyContent: "flex-start", fontSize: 12 }}
                                >
                                  {fr ? "Aucun" : "None"}
                                </button>
                                {operatorsLoading ? (
                                  <div style={{ fontSize: 11, color: "var(--text-secondary)", padding: "0.3rem 0.35rem" }}>
                                    {fr ? "Chargement..." : "Loading..."}
                                  </div>
                                ) : (
                                  operators.map((operator) => (
                                    <button
                                      key={`assign_${row.id}_${operator.id}`}
                                      type="button"
                                      onClick={(event) => { event.stopPropagation(); assignOperator(row.id, operator.id); }}
                                      className="admin-btn admin-btn-secondary"
                                      style={{ justifyContent: "flex-start", fontSize: 12 }}
                                    >
                                      {operator.fullName || operator.email}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.priceLabel}</span>
                          {assigned ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "var(--surface-secondary)",
                                  color: "var(--text-primary)",
                                  fontSize: 10,
                                  fontWeight: 600,
                                }}
                                title={assigned.fullName || assigned.email}
                              >
                                {assigned.profileImage ? (
                                  <img
                                    src={assigned.profileImage}
                                    alt={assigned.fullName || assigned.email}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  (assigned.fullName || assigned.email || "?").slice(0, 1).toUpperCase()
                                )}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        </div>
                        {insertAfter ? <div className="kanban-insert-line" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const tableRows = visibleRows.map((row) => ({
    ...row,
    stepLabel: `${row.step} / ${row.totalSteps}`,
    assignedOperator: row.assignedOperatorId ? operatorById.get(row.assignedOperatorId) : undefined,
  }));

  return (
    <TableWithColumnFilters
      title={fr ? "Bookings non finalisés" : "Unfinished Bookings"}
      description={fr ? "Prospects ayant commencé un booking sans le terminer." : "Prospects who started a booking without completing it."}
      data={tableRows}
      columns={[
        { key: "contactLabel", label: fr ? "Contact" : "Contact", filterType: "text" },
        { key: "email", label: "Email", filterType: "text", render: (row) => <span>{row.email || "—"}</span> },
        { key: "phone", label: fr ? "Téléphone" : "Phone", filterType: "text", render: (row) => <span>{row.phone || "—"}</span> },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "boxTypeName", label: fr ? "Type de box" : "Box Type", filterType: "text" },
        {
          key: "stepLabel",
          label: fr ? "Étape" : "Step",
          filterType: "text",
          render: (row) => {
            const pct = (row.step / row.totalSteps) * 100;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 50, height: 6, borderRadius: 3, background: "var(--surface-secondary, #e5e7eb)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: pct >= 80 ? "var(--color-success, #16a34a)" : pct >= 40 ? "var(--color-warning, #f59e0b)" : "var(--color-error, #dc2626)" }} />
                </div>
                <span style={{ fontSize: 12 }}>{row.stepLabel}</span>
              </div>
            );
          },
        },
        { key: "priceLabel", label: fr ? "Prix affiché" : "Displayed Price", filterType: "text" },
        {
          key: "assignedOperator",
          label: fr ? "Opérateur" : "Operator",
          filterType: "text",
          render: (row) => {
            const assigned = row.assignedOperator as OperatorAccount | undefined;
            if (!assigned) return <span style={{ color: "var(--text-secondary)" }}>—</span>;
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    overflow: "hidden",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--surface-secondary)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {assigned.profileImage ? (
                    <img
                      src={assigned.profileImage}
                      alt={assigned.fullName || assigned.email}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    (assigned.fullName || assigned.email || "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <span style={{ fontSize: 12 }}>{assigned.fullName || assigned.email}</span>
              </span>
            );
          },
        },
        {
          key: "source",
          label: "Source",
          filterType: "select",
          selectOptions: [
            { value: "bot-ia", label: "Bot IA" },
            { value: "landing-page", label: "Landing Page" },
            { value: "leboncoin", label: "Leboncoin" },
            { value: "site-front", label: "Site Front" },
            { value: "facebook", label: "Facebook" },
            { value: "google-ads", label: "Google Ads" },
            { value: "parrainage", label: "Parrainage" },
          ],
          render: (row) => {
            const colors: Record<string, string> = {
              "bot-ia": "#8b5cf6",
              "landing-page": "#0ea5e9",
              "leboncoin": "#f97316",
              "site-front": "#10b981",
              "facebook": "#3b82f6",
              "google-ads": "#ef4444",
              "parrainage": "#a855f7",
            };
            return (
              <span style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 500,
                background: `${colors[row.source] || "#6b7280"}18`,
                color: colors[row.source] || "#6b7280",
              }}>
                {row.source}
              </span>
            );
          },
        },
        { key: "stoppedLabel", label: fr ? "Arrêté le" : "Stopped At", filterType: "text" },
        {
          key: "id",
          label: "",
          filterType: "text",
          render: (row) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onOpenDetails(row as UnfinishedBookingRow)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="info" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Details" : "Details"}
              </button>
              <button
                type="button"
                onClick={() => window.alert(fr ? `Relance simulée pour ${row.contactLabel}` : `Simulated follow-up for ${row.contactLabel}`)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="reply" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Relancer" : "Follow up"}
              </button>
            </span>
          ),
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// QUOTE REQUESTS
// ──────────────────────────────────────────

function QuoteRequestsTab({
  fr,
  rows,
  setRows,
  viewMode,
  operatorFilter,
  priorityById,
  onOpenDetails,
  onOpenLeadModal,
}: {
  fr: boolean;
  rows: QuoteRow[];
  setRows: React.Dispatch<React.SetStateAction<QuoteRow[]>>;
  viewMode: ViewMode;
  operatorFilter: OperatorFilter;
  priorityById: Record<string, LeadPriorityPreview>;
  onOpenDetails: (row: QuoteRow) => void;
  onOpenLeadModal: (row: QuoteRow) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
  const pointerRef = useRef<{ cardId: string; x: number; y: number; moved: boolean } | null>(null);
  const statusOrder: QuoteStatus[] = ["new", "sent", "accepted", "expired", "abandoned"];

  const visibleRows = useMemo(() => {
    if (operatorFilter === "all") return rows;
    if (operatorFilter === "unassigned") return rows.filter((row) => !row.assignedOperatorId);
    return rows.filter((row) => row.assignedOperatorId === operatorFilter);
  }, [rows, operatorFilter]);

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      new: { bg: "var(--badge-blue-bg, #dbeafe)", text: "var(--badge-blue-text, #1e40af)" },
      sent: { bg: "var(--badge-yellow-bg, #fef9c3)", text: "var(--badge-yellow-text, #854d0e)" },
      accepted: { bg: "var(--badge-green-bg, #dcfce7)", text: "var(--badge-green-text, #166534)" },
      expired: { bg: "var(--badge-gray-bg, #f3f4f6)", text: "var(--badge-gray-text, #374151)" },
      abandoned: { bg: "var(--badge-red-bg, #fee2e2)", text: "var(--badge-red-text, #991b1b)" },
    };
    const c = colors[status] || colors.new;
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
  };

  const moveToStatus = (quoteId: string, nextStatus: QuoteStatus) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const lastIndexInColumn = without.reduce(
        (acc, row, index) => (row.status === nextStatus ? index : acc),
        -1
      );
      const insertIndex = lastIndexInColumn >= 0 ? lastIndexInColumn + 1 : without.length;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  const moveBeforeOrAfter = (
    quoteId: string,
    targetId: string,
    side: "before" | "after",
    nextStatus: QuoteStatus
  ) => {
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const targetIndex = without.findIndex((row) => row.id === targetId);
      if (targetIndex < 0) return current;

      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  if (viewMode === "kanban") {
    return (
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {fr
            ? "Kanban basé sur le statut: glisse une carte d'une colonne à l'autre."
            : "Status-based Kanban: drag a card from one status column to another."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${statusOrder.length}, minmax(220px, 1fr))`,
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.3rem",
          }}
        >
          {statusOrder.map((status) => {
            const statusRows = visibleRows
              .filter((row) => row.status === status)
              .slice()
              .sort((left, right) => {
                const leftScore = priorityById[left.id]?.score ?? 0;
                const rightScore = priorityById[right.id]?.score ?? 0;
                return rightScore - leftScore || left.id.localeCompare(right.id);
              });
            return (
              <div
                key={`quote_col_${status}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverColumn !== status) {
                    setDragOverColumn(status);
                  }
                }}
                onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStatus(draggingId, status);
                  setDraggingId(null);
                  setDragOverColumn(null);
                  setDragOverCardId(null);
                }}
                style={{
                  border: dragOverColumn === status ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: dragOverColumn === status ? "rgba(99,102,241,0.05)" : "var(--card-bg)",
                  minHeight: 260,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  transition: "border-color 0.12s, background 0.12s",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    padding: "0.55rem 0.7rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{getStatusLabel(status, fr)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{statusRows.length}</span>
                </div>

                <div style={{ padding: "0.55rem", display: "grid", gap: "0.45rem", alignContent: "start" }}>
                  {statusRows.map((row) => {
                    const priority = priorityById[row.id];
                    const tone = priority ? scoreToCardTone(priority.score) : null;
                    const heat = priority ? heatMeta(priority.salesHeat, fr) : null;
                    const insertBefore = draggingId && dragOverCardId === row.id && dragInsertSide === "before";
                    const insertAfter = draggingId && dragOverCardId === row.id && dragInsertSide === "after";

                    return (
                      <div key={row.id} style={{ display: "grid", gap: 4 }}>
                        {insertBefore ? <div className="kanban-insert-line" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingId(row.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverColumn(null);
                            setDragOverCardId(null);
                            pointerRef.current = null;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const nextSide = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            if (dragOverCardId !== row.id) setDragOverCardId(row.id);
                            if (dragInsertSide !== nextSide) setDragInsertSide(nextSide);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingId || draggingId === row.id) return;
                            moveBeforeOrAfter(draggingId, row.id, dragInsertSide, status);
                            setDraggingId(null);
                            setDragOverCardId(null);
                            setDragOverColumn(null);
                          }}
                          onMouseDown={(event) => {
                            pointerRef.current = { cardId: row.id, x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onMouseMove={(event) => {
                            if (!pointerRef.current || pointerRef.current.cardId !== row.id) return;
                            const dx = event.clientX - pointerRef.current.x;
                            const dy = event.clientY - pointerRef.current.y;
                            if (Math.hypot(dx, dy) > 6) {
                              pointerRef.current.moved = true;
                            }
                          }}
                          onMouseUp={(event) => {
                            const pointer = pointerRef.current;
                            pointerRef.current = null;
                            if (!pointer || pointer.cardId !== row.id || pointer.moved) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest("button, a, input, select, textarea")) return;
                            onOpenLeadModal(row);
                          }}
                          onMouseEnter={() => setHoveredCardId(row.id)}
                          onMouseLeave={() => setHoveredCardId(null)}
                          className="ui-hover-premium"
                          style={{
                            border:
                              hoveredCardId === row.id
                                ? "1px solid var(--accent-primary)"
                                : "1px solid var(--border-color)",
                            borderRadius: 8,
                            background:
                              hoveredCardId === row.id
                                ? "var(--surface-secondary, rgba(255,255,255,0.06))"
                                : "var(--surface-secondary, rgba(255,255,255,0.02))",
                            padding: "0.5rem",
                            cursor: draggingId === row.id ? "grabbing" : "grab",
                            display: "grid",
                            gap: "0.3rem",
                            opacity: draggingId === row.id ? 0 : 1,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{row.fullName}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.centerName}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.sizeLabel}</div>
                          {priority ? (
                            <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  borderRadius: 999,
                                  padding: "2px 7px",
                                  background: tone?.bg,
                                  color: tone?.text,
                                  fontWeight: 700,
                                }}
                              >
                                #{priority.rank} • {priority.score}
                              </span>
                              {heat ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    borderRadius: 999,
                                    padding: "2px 7px",
                                    background: heat.bg,
                                    color: heat.text,
                                    fontWeight: 700,
                                  }}
                                >
                                  {heat.label}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {insertAfter ? <div className="kanban-insert-line" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <TableWithColumnFilters
      title={fr ? "Demandes de devis" : "Quote Requests"}
      description={fr ? "Toutes les demandes de devis reçues." : "All received quote requests."}
      data={visibleRows}
      columns={[
        { key: "fullName", label: fr ? "Nom" : "Name", filterType: "text" },
        { key: "email", label: "Email", filterType: "text" },
        { key: "phone", label: fr ? "Téléphone" : "Phone", filterType: "text", render: (row) => <span>{row.phone || "—"}</span> },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "sizeLabel", label: fr ? "Taille" : "Size", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "new", label: fr ? "Nouveau" : "New" },
            { value: "sent", label: fr ? "Envoyé" : "Sent" },
            { value: "accepted", label: fr ? "Accepté" : "Accepted" },
            { value: "expired", label: fr ? "Expiré" : "Expired" },
            { value: "abandoned", label: fr ? "Abandonné" : "Abandoned" },
          ],
          render: (row) => statusBadge(row.status),
        },
        { key: "createdLabel", label: fr ? "Créé le" : "Created", filterType: "text" },
        { key: "sentLabel", label: fr ? "Envoyé le" : "Sent", filterType: "text" },
        {
          key: "message",
          label: "Message",
          filterType: "text",
          render: (row) => (
            <span style={{ fontSize: 12, maxWidth: 200, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.message || "—"}
            </span>
          ),
        },
        {
          key: "id",
          label: "",
          filterType: "text",
          render: (row) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onOpenDetails(row as QuoteRow)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="info" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Details" : "Details"}
              </button>
              {row.status === "new" ? (
                <button
                  type="button"
                  onClick={() => window.alert(fr ? `Envoi de devis simulé pour ${row.fullName}` : `Simulated quote send for ${row.fullName}`)}
                  className="admin-btn admin-btn-primary"
                  style={{ padding: "3px 10px", fontSize: 11 }}
                >
                  <MaterialSymbol name="send" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                  {fr ? "Envoyer" : "Send"}
                </button>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  );
}

// ──────────────────────────────────────────
// ABANDONED QUOTES
// ──────────────────────────────────────────

function AbandonedQuotesTab({
  fr,
  rows,
  setRows,
  viewMode,
  operatorFilter,
  priorityById,
  onOpenDetails,
  onOpenLeadModal,
}: {
  fr: boolean;
  rows: QuoteRow[];
  setRows: React.Dispatch<React.SetStateAction<QuoteRow[]>>;
  viewMode: ViewMode;
  operatorFilter: OperatorFilter;
  priorityById: Record<string, LeadPriorityPreview>;
  onOpenDetails: (row: QuoteRow) => void;
  onOpenLeadModal: (row: QuoteRow) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertSide, setDragInsertSide] = useState<"before" | "after">("before");
  const pointerRef = useRef<{ cardId: string; x: number; y: number; moved: boolean } | null>(null);
  const filteredRows = useMemo(() => {
    const base = rows.filter((q) => q.status === "abandoned" || q.status === "expired");
    if (operatorFilter === "all") return base;
    if (operatorFilter === "unassigned") return base.filter((row) => !row.assignedOperatorId);
    return base.filter((row) => row.assignedOperatorId === operatorFilter);
  }, [rows, operatorFilter]);
  const statusOrder: QuoteStatus[] = ["expired", "abandoned"];

  const moveToStatus = (quoteId: string, nextStatus: QuoteStatus) => {
    if (nextStatus !== "expired" && nextStatus !== "abandoned") return;
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const lastIndexInColumn = without.reduce(
        (acc, row, index) => (row.status === nextStatus ? index : acc),
        -1
      );
      const insertIndex = lastIndexInColumn >= 0 ? lastIndexInColumn + 1 : without.length;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  const moveBeforeOrAfter = (
    quoteId: string,
    targetId: string,
    side: "before" | "after",
    nextStatus: QuoteStatus
  ) => {
    if (nextStatus !== "expired" && nextStatus !== "abandoned") return;
    setRows((current) => {
      const moving = current.find((row) => row.id === quoteId);
      if (!moving) return current;
      const without = current.filter((row) => row.id !== quoteId);
      const targetIndex = without.findIndex((row) => row.id === targetId);
      if (targetIndex < 0) return current;

      const next = {
        ...moving,
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus, fr),
      };
      const insertIndex = side === "after" ? targetIndex + 1 : targetIndex;
      return [...without.slice(0, insertIndex), next, ...without.slice(insertIndex)];
    });
  };

  if (filteredRows.length === 0) {
    return (
      <div className="admin-placeholder-card" style={{ padding: 20, textAlign: "center" }}>
        <MaterialSymbol name="check_circle" style={{ fontSize: 40, color: "var(--color-success, #16a34a)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fr ? "Aucun devis abandonné." : "No abandoned quotes."}</p>
      </div>
    );
  }

  if (viewMode === "kanban") {
    return (
      <div style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {fr
            ? "Kanban basé sur la colonne statut (Expiré / Abandonné)."
            : "Kanban based on status column (Expired / Abandoned)."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(240px, 1fr))",
            gap: "0.6rem",
            overflowX: "auto",
            paddingBottom: "0.3rem",
          }}
        >
          {statusOrder.map((status) => {
            const statusRows = filteredRows
              .filter((row) => row.status === status)
              .slice()
              .sort((left, right) => {
                const leftScore = priorityById[left.id]?.score ?? 0;
                const rightScore = priorityById[right.id]?.score ?? 0;
                return rightScore - leftScore || left.id.localeCompare(right.id);
              });
            return (
              <div
                key={`abandoned_col_${status}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverColumn !== status) {
                    setDragOverColumn(status);
                  }
                }}
                onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
                onDrop={() => {
                  if (!draggingId) return;
                  moveToStatus(draggingId, status);
                  setDraggingId(null);
                  setDragOverColumn(null);
                  setDragOverCardId(null);
                }}
                style={{
                  border: dragOverColumn === status ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: 10,
                  background: dragOverColumn === status ? "rgba(99,102,241,0.05)" : "var(--card-bg)",
                  minHeight: 260,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  transition: "border-color 0.12s, background 0.12s",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    padding: "0.55rem 0.7rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{getStatusLabel(status, fr)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{statusRows.length}</span>
                </div>

                <div style={{ padding: "0.55rem", display: "grid", gap: "0.45rem", alignContent: "start" }}>
                  {statusRows.map((row) => {
                    const priority = priorityById[row.id];
                    const tone = priority ? scoreToCardTone(priority.score) : null;
                    const heat = priority ? heatMeta(priority.salesHeat, fr) : null;
                    const insertBefore = draggingId && dragOverCardId === row.id && dragInsertSide === "before";
                    const insertAfter = draggingId && dragOverCardId === row.id && dragInsertSide === "after";

                    return (
                      <div key={row.id} style={{ display: "grid", gap: 4 }}>
                        {insertBefore ? <div className="kanban-insert-line" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingId(row.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverColumn(null);
                            setDragOverCardId(null);
                            pointerRef.current = null;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const nextSide = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            if (dragOverCardId !== row.id) setDragOverCardId(row.id);
                            if (dragInsertSide !== nextSide) setDragInsertSide(nextSide);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingId || draggingId === row.id) return;
                            moveBeforeOrAfter(draggingId, row.id, dragInsertSide, status);
                            setDraggingId(null);
                            setDragOverCardId(null);
                            setDragOverColumn(null);
                          }}
                          onMouseDown={(event) => {
                            pointerRef.current = { cardId: row.id, x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onMouseMove={(event) => {
                            if (!pointerRef.current || pointerRef.current.cardId !== row.id) return;
                            const dx = event.clientX - pointerRef.current.x;
                            const dy = event.clientY - pointerRef.current.y;
                            if (Math.hypot(dx, dy) > 6) {
                              pointerRef.current.moved = true;
                            }
                          }}
                          onMouseUp={(event) => {
                            const pointer = pointerRef.current;
                            pointerRef.current = null;
                            if (!pointer || pointer.cardId !== row.id || pointer.moved) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest("button, a, input, select, textarea")) return;
                            onOpenLeadModal(row);
                          }}
                          onMouseEnter={() => setHoveredCardId(row.id)}
                          onMouseLeave={() => setHoveredCardId(null)}
                          className="ui-hover-premium"
                          style={{
                            border:
                              hoveredCardId === row.id
                                ? "1px solid var(--accent-primary)"
                                : "1px solid var(--border-color)",
                            borderRadius: 8,
                            background:
                              hoveredCardId === row.id
                                ? "var(--surface-secondary, rgba(255,255,255,0.06))"
                                : "var(--surface-secondary, rgba(255,255,255,0.02))",
                            padding: "0.5rem",
                            cursor: draggingId === row.id ? "grabbing" : "grab",
                            display: "grid",
                            gap: "0.3rem",
                            opacity: draggingId === row.id ? 0 : 1,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{row.fullName}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.centerName}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.sizeLabel}</div>
                          {priority ? (
                            <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  borderRadius: 999,
                                  padding: "2px 7px",
                                  background: tone?.bg,
                                  color: tone?.text,
                                  fontWeight: 700,
                                }}
                              >
                                #{priority.rank} • {priority.score}
                              </span>
                              {heat ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    borderRadius: 999,
                                    padding: "2px 7px",
                                    background: heat.bg,
                                    color: heat.text,
                                    fontWeight: 700,
                                  }}
                                >
                                  {heat.label}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {insertAfter ? <div className="kanban-insert-line" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <TableWithColumnFilters
      title={fr ? "Devis non finalisés" : "Unfinished Quotes"}
      description={fr ? "Devis expirés ou abandonnés nécessitant un suivi." : "Expired or abandoned quotes needing follow-up."}
      data={filteredRows}
      columns={[
        { key: "fullName", label: fr ? "Nom" : "Name", filterType: "text" },
        { key: "email", label: "Email", filterType: "text" },
        { key: "centerName", label: fr ? "Centre" : "Center", filterType: "text" },
        { key: "sizeLabel", label: fr ? "Taille" : "Size", filterType: "text" },
        {
          key: "status",
          label: fr ? "Statut" : "Status",
          filterType: "select",
          selectOptions: [
            { value: "abandoned", label: fr ? "Abandonné" : "Abandoned" },
            { value: "expired", label: fr ? "Expiré" : "Expired" },
          ],
          render: (row) => (
            <span style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: row.status === "abandoned" ? "var(--badge-red-bg, #fee2e2)" : "var(--badge-gray-bg, #f3f4f6)",
              color: row.status === "abandoned" ? "var(--badge-red-text, #991b1b)" : "var(--badge-gray-text, #374151)",
            }}>
              {row.statusLabel}
            </span>
          ),
        },
        { key: "createdLabel", label: fr ? "Créé le" : "Created", filterType: "text" },
        {
          key: "id",
          label: "",
          filterType: "text",
          render: (row) => (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onOpenDetails(row as QuoteRow)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="info" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Details" : "Details"}
              </button>
              <button
                type="button"
                onClick={() => window.alert(fr ? `Relance simulée pour ${row.fullName}` : `Simulated follow-up for ${row.fullName}`)}
                className="admin-btn admin-btn-secondary"
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                <MaterialSymbol name="reply" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />
                {fr ? "Relancer" : "Follow up"}
              </button>
            </span>
          ),
        },
      ]}
    />
  );
}

function LeadPrioritizationModal({
  fr,
  onClose,
  scoringConfig,
  setScoringConfig,
  manualByLead,
  setManualByLead,
  priorities,
}: {
  fr: boolean;
  onClose: () => void;
  scoringConfig: LeadScoringConfig;
  setScoringConfig: React.Dispatch<React.SetStateAction<LeadScoringConfig>>;
  manualByLead: Record<string, LeadManualScoringInput>;
  setManualByLead: React.Dispatch<
    React.SetStateAction<Record<string, LeadManualScoringInput>>
  >;
  priorities: LeadPriorityPreview[];
}) {
  const [previewKey, setPreviewKey] = useState<string>(priorities[0]?.key ?? "");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const pointsUsed = useMemo(() => getScoringPointsUsed(scoringConfig), [scoringConfig]);
  const maxLevel = Math.max(1, scoringConfig.levelCount - 1);
  const effectivePreviewKey =
    previewKey && priorities.some((item) => item.key === previewKey)
      ? previewKey
      : priorities[0]?.key ?? "";
  const previewLead = priorities.find((item) => item.key === effectivePreviewKey) ?? priorities[0] ?? null;

  const axisLabels: Record<LeadScoringAxisKey, string> = {
    centerPriority: fr ? "Centre" : "Center",
    boxSizePriority: fr ? "Taille" : "Size",
    startDateUrgency: fr ? "Date" : "Start",
    concernPriority: fr ? "Personne" : "Concern",
    contactCompleteness: fr ? "Contact" : "Contact",
    unpaidRisk: fr ? "Risque" : "Risk",
    salesHeat: fr ? "Chaleur" : "Heat",
  };

  const axisOrder: LeadScoringAxisKey[] = [
    "centerPriority",
    "boxSizePriority",
    "startDateUrgency",
    "concernPriority",
    "contactCompleteness",
    "unpaidRisk",
    "salesHeat",
  ];

  const coefficientAxes: SpiderAxis[] = axisOrder.map((axisKey) => ({
    key: axisKey,
    label: axisLabels[axisKey],
    value: scoreFromLevel(scoringConfig.axisWeights[axisKey], scoringConfig.levelCount),
  }));

  const leadAxes: SpiderAxis[] = previewLead
    ? axisOrder.map((axisKey) => ({
        key: axisKey,
        label: axisLabels[axisKey],
        value: previewLead.axisScores[axisKey],
      }))
    : coefficientAxes;

  const setAxisWeightLevel = (axisKey: LeadScoringAxisKey, nextValue: number) => {
    setScoringConfig((current) => {
      const currentValue = current.axisWeights[axisKey] ?? 0;
      const allowed = getBudgetedLevelValue(current, nextValue, currentValue);
      return {
        ...current,
        axisWeights: {
          ...current.axisWeights,
          [axisKey]: allowed,
        },
      };
    });
  };

  const setCenterLevel = (centerId: string, nextValue: number) => {
    setScoringConfig((current) => {
      const currentValue = current.centerPriorityLevels[centerId] ?? 0;
      const allowed = getBudgetedLevelValue(current, nextValue, currentValue);
      return {
        ...current,
        centerPriorityLevels: {
          ...current.centerPriorityLevels,
          [centerId]: allowed,
        },
      };
    });
  };

  const setBoxTypeLevel = (centerId: string, boxTypeId: string, nextValue: number) => {
    setScoringConfig((current) => {
      const centerBucket = current.boxTypePriorityLevelsByCenter[centerId] ?? {};
      const currentValue = centerBucket[boxTypeId] ?? 0;
      const allowed = getBudgetedLevelValue(current, nextValue, currentValue);

      return {
        ...current,
        boxTypePriorityLevelsByCenter: {
          ...current.boxTypePriorityLevelsByCenter,
          [centerId]: {
            ...centerBucket,
            [boxTypeId]: allowed,
          },
        },
      };
    });
  };

  const setLevelCount = (nextCount: number) => {
    setScoringConfig((current) =>
      withUpdatedLevelCount(current, nextCount, centers, boxTypes)
    );
  };

  const setManualField = (
    key: string,
    patch: Partial<LeadManualScoringInput>
  ) => {
    setManualByLead((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        ...patch,
      },
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10060,
        background: "rgba(0,0,0,0.55)",
        padding: 16,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1480px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 14,
          boxShadow: "0 20px 45px rgba(0,0,0,0.32)",
          display: "grid",
          gap: 12,
          padding: "0.9rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {fr ? "Priorisation des leads" : "Lead prioritization"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {fr
                ? "Ajuste les coefficients pour reclasser automatiquement les cartes du Kanban."
                : "Adjust coefficients to automatically reorder Kanban cards."}
            </div>
          </div>

          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onClose}
            style={{ padding: "0.35rem 0.6rem" }}
          >
            {fr ? "Fermer" : "Close"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 12, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "0.75rem",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 14 }}>{fr ? "Regles de scoring" : "Scoring rules"}</strong>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{fr ? "Niveaux" : "Levels"}</span>
                  <input
                    type="number"
                    min={2}
                    max={7}
                    value={scoringConfig.levelCount}
                    onChange={(event) => setLevelCount(Number(event.target.value) || 2)}
                    style={{
                      width: 62,
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      padding: "0.25rem 0.4rem",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  borderRadius: 10,
                  border: "1px dashed var(--border-color)",
                  padding: "0.6rem",
                  fontSize: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {fr ? "Budget utilise" : "Used budget"}: <strong>{pointsUsed}</strong> / {scoringConfig.maxBudget}
                </span>
                <span style={{ color: pointsUsed >= scoringConfig.maxBudget ? "#b91c1c" : "var(--text-secondary)" }}>
                  {fr ? "Reste" : "Remaining"}: {Math.max(0, scoringConfig.maxBudget - pointsUsed)}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "center" }}>
                <div style={{ justifySelf: "center" }}>
                  <LeadSpiderChart axes={coefficientAxes} size={250} stroke="#2563eb" fill="rgba(37,99,235,0.15)" />
                </div>
                <div style={{ justifySelf: "center" }}>
                  <LeadSpiderChart axes={leadAxes} size={250} stroke="#16a34a" fill="rgba(22,163,74,0.16)" />
                </div>
              </div>

              <div style={{ display: "grid", gap: 7 }}>
                {axisOrder.map((axisKey) => {
                  const value = scoringConfig.axisWeights[axisKey] ?? 0;
                  return (
                    <label key={`axis_weight_${axisKey}`} style={{ display: "grid", gap: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>{axisLabels[axisKey]}</span>
                        <strong>{value}</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={maxLevel}
                        step={1}
                        value={value}
                        onChange={(event) => setAxisWeightLevel(axisKey, Number(event.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "0.75rem",
                display: "grid",
                gap: 10,
              }}
            >
              <strong style={{ fontSize: 14 }}>
                {fr ? "Mini-toiles tailles par centre" : "Center box-size mini spiders"}
              </strong>

              <div style={{ display: "grid", gap: 10 }}>
                {centers.map((center) => {
                  const centerValue = scoringConfig.centerPriorityLevels[center.id] ?? 0;
                  const centerBoxTypes = boxTypes.filter((boxType) => boxType.centerId === center.id);
                  const miniAxes: SpiderAxis[] = centerBoxTypes.map((boxType) => ({
                    key: boxType.id,
                    label: `${boxType.sizeM2}m2`,
                    value: scoreFromLevel(
                      scoringConfig.boxTypePriorityLevelsByCenter[center.id]?.[boxType.id] ?? 0,
                      scoringConfig.levelCount
                    ),
                  }));

                  return (
                    <div
                      key={`center_priority_${center.id}`}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        padding: "0.6rem",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center" }}>
                        <div>
                          <LeadSpiderChart
                            axes={miniAxes.length >= 3 ? miniAxes : [...miniAxes, ...miniAxes, ...miniAxes].slice(0, 3)}
                            size={160}
                            stroke="#0ea5e9"
                            fill="rgba(14,165,233,0.16)"
                          />
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{center.name}</div>
                          <label style={{ display: "grid", gap: 3 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span>{fr ? "Priorite centre" : "Center priority"}</span>
                              <strong>{centerValue}</strong>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={maxLevel}
                              step={1}
                              value={centerValue}
                              onChange={(event) => setCenterLevel(center.id, Number(event.target.value))}
                            />
                          </label>

                          {centerBoxTypes.map((boxType) => {
                            const value =
                              scoringConfig.boxTypePriorityLevelsByCenter[center.id]?.[boxType.id] ?? 0;
                            return (
                              <label key={`box_priority_${center.id}_${boxType.id}`} style={{ display: "grid", gap: 3 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span>
                                    {boxType.name} ({boxType.sizeM2}m2)
                                  </span>
                                  <strong>{value}</strong>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={maxLevel}
                                  step={1}
                                  value={value}
                                  onChange={(event) =>
                                    setBoxTypeLevel(center.id, boxType.id, Number(event.target.value))
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "0.75rem",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>
                  {fr ? "Scoring manuel Sales" : "Sales manual scoring"}
                </strong>

                <select
                  value={effectivePreviewKey}
                  onChange={(event) => setPreviewKey(event.target.value)}
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    padding: "0.3rem 0.5rem",
                    fontSize: 12,
                    maxWidth: 320,
                  }}
                >
                  {priorities.slice(0, 50).map((item) => (
                    <option key={`preview_option_${item.key}`} value={item.key}>
                      {item.label} • {item.score}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  maxHeight: "56vh",
                  overflow: "auto",
                  display: "grid",
                  gap: 8,
                }}
              >
                {priorities.map((item) => {
                  const manual = manualByLead[item.key] ?? {};
                  const heat = heatMeta(item.salesHeat, fr);

                  return (
                    <div
                      key={`manual_row_${item.key}`}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        padding: "0.55rem",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {item.kind === "unfinished" ? (fr ? "Booking interrompu" : "Interrupted booking") : fr ? "Demande de devis" : "Quote request"}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            borderRadius: 999,
                            padding: "2px 8px",
                            background: scoreToCardTone(item.score).bg,
                            color: scoreToCardTone(item.score).text,
                            fontWeight: 700,
                            height: "fit-content",
                          }}
                        >
                          #{item.rank} • {item.score}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label style={{ display: "grid", gap: 3 }}>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {fr ? "Chaleur" : "Heat"}
                          </span>
                          <select
                            value={manual.salesHeat ?? item.salesHeat}
                            onChange={(event) =>
                              setManualField(item.key, {
                                salesHeat: event.target.value as SalesHeatLevel,
                              })
                            }
                            style={{
                              borderRadius: 8,
                              border: "1px solid var(--border-color)",
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                              padding: "0.35rem 0.45rem",
                              fontSize: 12,
                            }}
                          >
                            <option value="hot">{fr ? "Chaud (rouge)" : "Hot (red)"}</option>
                            <option value="warm">{fr ? "Tiede (orange)" : "Warm (orange)"}</option>
                            <option value="cold">{fr ? "Froid (jaune)" : "Cold (yellow)"}</option>
                          </select>
                        </label>

                        <label style={{ display: "grid", gap: 3 }}>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {fr ? "Personne concernee" : "Concerned person"}
                          </span>
                          <select
                            value={manual.concernKind ?? item.concernKind}
                            onChange={(event) =>
                              setManualField(item.key, {
                                concernKind: event.target.value as LeadConcernKind,
                              })
                            }
                            style={{
                              borderRadius: 8,
                              border: "1px solid var(--border-color)",
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                              padding: "0.35rem 0.45rem",
                              fontSize: 12,
                            }}
                          >
                            <option value="self">{fr ? "Lui-meme" : "Self"}</option>
                            <option value="third_party">{fr ? "Tiers" : "Third party"}</option>
                            <option value="company">{fr ? "Societe" : "Company"}</option>
                          </select>
                        </label>
                      </div>

                      <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span>
                          {fr ? "Score auto" : "Auto score"}: <strong>{item.autoScore}</strong>
                        </span>
                        <span style={{ color: heat.text }}>
                          {fr ? "Chaleur" : "Heat"}: <strong>{heat.label}</strong>
                        </span>
                        <span>
                          {fr ? "Personne" : "Concern"}: <strong>{concernLabel(item.concernKind, fr)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadKanbanDetailsModal({
  fr,
  selection,
  operatorById,
  quoteRows,
  onClose,
}: {
  fr: boolean;
  selection: LeadModalSelection;
  operatorById: Map<string, OperatorAccount>;
  quoteRows: QuoteRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const clientId = useMemo(() => resolveLeadClientId(selection, quoteRows), [selection, quoteRows]);

  const unpaidInvoices = useMemo(() => {
    if (!clientId) return [];
    return getUnpaidInvoicesByClient(clientId);
  }, [clientId]);

  const conversations = useMemo(() => {
    if (!clientId) {
      return buildFallbackConversations(selection, fr);
    }

    const threads = getConversationsByClient(clientId);
    const items: LeadConversationItem[] = threads
      .flatMap((thread) =>
        thread.messages.map((message) => ({
          id: message.id,
          channel: thread.type,
          direction: message.direction,
          content: message.content,
          timestamp: message.timestamp,
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (items.length === 0) {
      return buildFallbackConversations(selection, fr);
    }

    return items.slice(0, 18);
  }, [clientId, fr, selection]);

  const leadPrice = useMemo(() => estimateLeadPrice(selection), [selection]);
  const desiredMoveInDate = useMemo(() => estimateDesiredMoveInDate(selection), [selection]);
  const quality = useMemo(
    () => computeLeadQuality(selection, unpaidInvoices.length, conversations.length > 0, fr),
    [selection, unpaidInvoices.length, conversations.length, fr]
  );

  const assignedOperator = selection.row.assignedOperatorId
    ? operatorById.get(selection.row.assignedOperatorId)
    : undefined;

  const leadName =
    selection.kind === "unfinished"
      ? selection.row.contactLabel
      : selection.row.fullName || selection.row.email || selection.row.phone || "—";

  const requestLabel =
    selection.kind === "quote"
      ? selection.row.message || (fr ? "Demande de devis" : "Quote request")
      : fr
      ? `Booking interrompu à l'étape ${selection.row.step} / ${selection.row.totalSteps}.`
      : `Booking interrupted at step ${selection.row.step} / ${selection.row.totalSteps}.`;

  const wantedSizeLabel =
    selection.kind === "quote" ? selection.row.sizeLabel : selection.row.boxTypeName;

  const desiredPriceLabel =
    leadPrice !== null
      ? `${leadPrice.toLocaleString(fr ? "fr-FR" : "en-US")} € / ${fr ? "mois" : "month"}`
      : fr
      ? "Non renseigné"
      : "Unknown";

  const unpaidLabel =
    unpaidInvoices.length > 0
      ? fr
        ? `Oui (${unpaidInvoices.length})`
        : `Yes (${unpaidInvoices.length})`
      : clientId
      ? fr
        ? "Non"
        : "No"
      : fr
      ? "Inconnu"
      : "Unknown";

  const desiredSizeFromLead =
    selection.kind === "quote"
      ? selection.row.boxSizeWanted
      : (boxTypes.find((boxType) => boxType.id === selection.row.boxTypeId)?.sizeM2 ?? 1);

  const initialCenterId = selection.row.centerId;
  const initialBoxType = pickNearestBoxTypeForCenter(initialCenterId, desiredSizeFromLead);

  const [reservationCenterId, setReservationCenterId] = useState(initialCenterId);
  const [reservationBoxTypeId, setReservationBoxTypeId] = useState(initialBoxType?.id ?? "");
  const [reservationSizeM2, setReservationSizeM2] = useState<number>(
    initialBoxType?.sizeM2 ?? desiredSizeFromLead
  );
  const [reservationPrice, setReservationPrice] = useState<number>(
    leadPrice ?? initialBoxType?.basePrice ?? 0
  );
  const [reservationStartDate, setReservationStartDate] = useState(
    desiredMoveInDate.slice(0, 10)
  );
  const [reservationOperatorId, setReservationOperatorId] = useState(
    selection.row.assignedOperatorId ?? ""
  );
  const [reservationNotes, setReservationNotes] = useState(requestLabel);
  const [reservationCopied, setReservationCopied] = useState(false);

  const reservationCenter = useMemo(() => {
    return centers.find((center) => center.id === reservationCenterId);
  }, [reservationCenterId]);

  const reservationBoxOptions = useMemo(() => {
    return boxTypes
      .filter((boxType) => boxType.centerId === reservationCenterId)
      .sort((left, right) => left.sizeM2 - right.sizeM2);
  }, [reservationCenterId]);

  const operatorOptions = useMemo(() => {
    return Array.from(operatorById.values()).sort((left, right) => {
      const leftName = left.fullName || left.email;
      const rightName = right.fullName || right.email;
      return leftName.localeCompare(rightName);
    });
  }, [operatorById]);

  const selectedReservationOperator = reservationOperatorId
    ? operatorById.get(reservationOperatorId)
    : undefined;

  const reservationInputStyle = {
    width: "100%",
    borderRadius: 8,
    border: "1px solid var(--border-color)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    padding: "0.45rem 0.55rem",
    fontSize: 12,
  };

  const handleCenterChange = (nextCenterId: string) => {
    setReservationCenterId(nextCenterId);
    const nearest = pickNearestBoxTypeForCenter(nextCenterId, reservationSizeM2);
    setReservationBoxTypeId(nearest?.id ?? "");
    if (nearest) {
      setReservationSizeM2(nearest.sizeM2);
      setReservationPrice(nearest.basePrice);
    }
  };

  const handleBoxTypeChange = (nextBoxTypeId: string) => {
    setReservationBoxTypeId(nextBoxTypeId);
    const selectedBoxType = reservationBoxOptions.find((boxType) => boxType.id === nextBoxTypeId);
    if (!selectedBoxType) return;
    setReservationSizeM2(selectedBoxType.sizeM2);
    setReservationPrice(selectedBoxType.basePrice);
  };

  const copyReservationDraft = async () => {
    const payload = {
      leadId: selection.row.id,
      centerId: reservationCenterId,
      boxTypeId: reservationBoxTypeId || null,
      sizeM2: reservationSizeM2,
      price: reservationPrice,
      startDate: reservationStartDate,
      operatorId: reservationOperatorId || null,
      contact: {
        name: leadName,
        email: selection.row.email || null,
        phone: selection.row.phone || null,
      },
      notes: reservationNotes,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setReservationCopied(true);
      window.setTimeout(() => setReservationCopied(false), 1200);
    } catch {
      // ignore clipboard failures
    }
  };

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        background: "rgba(0,0,0,0.5)",
        padding: 16,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1360px, 100%)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 14,
          boxShadow: "0 20px 45px rgba(0,0,0,0.32)",
          display: "grid",
          gap: 12,
          padding: "0.85rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{leadName}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {selection.row.email || "—"} {selection.row.phone ? `• ${selection.row.phone}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-secondary"
            style={{ padding: "0.35rem 0.6rem" }}
          >
            {fr ? "Fermer" : "Close"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: "0.7rem",
              display: "grid",
              gap: 8,
              alignContent: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{fr ? "Conversations" : "Conversations"}</strong>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {conversations.length} {fr ? "messages" : "messages"}
              </span>
            </div>

            <div style={{ display: "grid", gap: 8, maxHeight: "62vh", overflow: "auto", paddingRight: 2 }}>
              {conversations.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: "grid",
                    justifyItems: message.direction === "inbound" ? "start" : "end",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "0.5rem 0.65rem",
                      borderRadius: 10,
                      border: "1px solid var(--border-color)",
                      background:
                        message.direction === "inbound"
                          ? "var(--surface-secondary, rgba(255,255,255,0.04))"
                          : "rgba(79,70,229,0.14)",
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {message.content}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                    {message.channel.toUpperCase()} • {formatDateTimeLabel(message.timestamp, fr)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "0.7rem",
                display: "grid",
                gap: 8,
              }}
            >
              <strong style={{ fontSize: 14 }}>{fr ? "Fiche lead" : "Lead details"}</strong>

              <div style={{ fontSize: 12 }}>
                <div style={{ color: "var(--text-secondary)" }}>{fr ? "Demande" : "Request"}</div>
                <div style={{ marginTop: 2 }}>{requestLabel}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{fr ? "Taille box" : "Box size"}</div>
                  <div>{wantedSizeLabel}</div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{fr ? "Prix box voulu" : "Wanted box price"}</div>
                  <div>{desiredPriceLabel}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{fr ? "A partir du" : "From"}</div>
                  <div>{formatDateLabel(desiredMoveInDate, fr)}</div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{fr ? "Opérateur assigné" : "Assigned operator"}</div>
                  <div>{assignedOperator ? assignedOperator.fullName || assignedOperator.email : "—"}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{fr ? "Impayés" : "Unpaid history"}</div>
                  <div>{unpaidLabel}</div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-secondary)" }}>{fr ? "Source" : "Source"}</div>
                  <div>{selection.kind === "unfinished" ? selection.row.source : "quote"}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "0.7rem",
                display: "grid",
                gap: 7,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 14 }}>{fr ? "Qualité du lead" : "Lead quality"}</strong>
                <span
                  style={{
                    fontSize: 11,
                    borderRadius: 999,
                    padding: "3px 8px",
                    background: quality.bg,
                    color: quality.text,
                    fontWeight: 700,
                  }}
                >
                  {quality.label}
                </span>
              </div>

              <div
                style={{
                  height: 8,
                  width: "100%",
                  borderRadius: 999,
                  background: "var(--surface-secondary, rgba(255,255,255,0.06))",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${quality.score}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: quality.text,
                  }}
                />
              </div>

              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {fr
                  ? "Score calculé avec la complétude du contact, l'avancement, les échanges, et l'historique de paiement."
                  : "Score is computed from contact completeness, progression, conversations, and payment history."}
              </div>
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: "0.7rem",
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            <strong style={{ fontSize: 14 }}>
              {fr ? "Reservation pre-remplie" : "Pre-filled reservation"}
            </strong>

            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {fr
                ? "Tu peux modifier toutes les informations avant de lancer la reservation."
                : "You can edit all details before creating the booking."}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{fr ? "Centre" : "Center"}</span>
                <select
                  value={reservationCenterId}
                  onChange={(event) => handleCenterChange(event.target.value)}
                  style={reservationInputStyle}
                >
                  {centers.map((center) => (
                    <option key={`reservation_center_${center.id}`} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{fr ? "Type de box" : "Box type"}</span>
                <select
                  value={reservationBoxTypeId}
                  onChange={(event) => handleBoxTypeChange(event.target.value)}
                  style={reservationInputStyle}
                >
                  {reservationBoxOptions.map((boxType) => (
                    <option key={`reservation_box_${boxType.id}`} value={boxType.id}>
                      {boxType.name} • {boxType.sizeM2} m2 • {boxType.basePrice} €
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{fr ? "Taille (m2)" : "Size (m2)"}</span>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={reservationSizeM2}
                    onChange={(event) => setReservationSizeM2(Number(event.target.value) || 0)}
                    style={reservationInputStyle}
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{fr ? "Prix mensuel (€)" : "Monthly price (€)"}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={reservationPrice}
                    onChange={(event) => setReservationPrice(Number(event.target.value) || 0)}
                    style={reservationInputStyle}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{fr ? "Date de debut" : "Start date"}</span>
                <input
                  type="date"
                  value={reservationStartDate}
                  onChange={(event) => setReservationStartDate(event.target.value)}
                  style={reservationInputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{fr ? "Operateur" : "Operator"}</span>
                <select
                  value={reservationOperatorId}
                  onChange={(event) => setReservationOperatorId(event.target.value)}
                  style={reservationInputStyle}
                >
                  <option value="">{fr ? "Non assigne" : "Unassigned"}</option>
                  {operatorOptions.map((operator) => (
                    <option key={`reservation_operator_${operator.id}`} value={operator.id}>
                      {operator.fullName || operator.email}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{fr ? "Notes" : "Notes"}</span>
                <textarea
                  value={reservationNotes}
                  onChange={(event) => setReservationNotes(event.target.value)}
                  rows={4}
                  style={{
                    ...reservationInputStyle,
                    resize: "vertical",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                borderRadius: 10,
                border: "1px dashed var(--border-color)",
                padding: "0.55rem",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              <div>
                <strong>{fr ? "Resume" : "Summary"}:</strong> {reservationCenter?.name || reservationCenterId}
              </div>
              <div>
                {reservationSizeM2} m2 • {reservationPrice} € / {fr ? "mois" : "month"}
              </div>
              <div>
                {fr ? "Debut" : "Start"}: {reservationStartDate || "—"}
              </div>
              <div>
                {fr ? "Operateur" : "Operator"}: {selectedReservationOperator ? selectedReservationOperator.fullName || selectedReservationOperator.email : "—"}
              </div>
            </div>

            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => void copyReservationDraft()}
              style={{ justifyContent: "center" }}
            >
              {reservationCopied
                ? fr
                  ? "Brouillon copie"
                  : "Draft copied"
                : fr
                ? "Copier le brouillon de reservation"
                : "Copy reservation draft"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalNode, document.body);
}
