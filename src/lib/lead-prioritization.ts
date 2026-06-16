export type SalesHeatLevel = "hot" | "warm" | "cold";

export type LeadConcernKind = "self" | "third_party" | "company";

export type LeadScoringAxisKey =
  | "centerPriority"
  | "boxSizePriority"
  | "startDateUrgency"
  | "concernPriority"
  | "contactCompleteness"
  | "unpaidRisk"
  | "salesHeat";

export type LeadScoringAxisWeights = Record<LeadScoringAxisKey, number>;

export type LeadScoringConfig = {
  levelCount: number;
  maxBudget: number;
  axisWeights: LeadScoringAxisWeights;
  centerPriorityLevels: Record<string, number>;
  boxTypePriorityLevelsByCenter: Record<string, Record<string, number>>;
};

export type LeadManualScoringInput = {
  salesHeat?: SalesHeatLevel;
  concernKind?: LeadConcernKind;
};

export type LeadScoringPayload = {
  config: LeadScoringConfig;
  manualByLead: Record<string, LeadManualScoringInput>;
};

export type LeadAxisScores = Record<LeadScoringAxisKey, number>;

export type LeadComputedPriority = {
  totalScore: number;
  autoScore: number;
  axisScores: LeadAxisScores;
  salesHeat: SalesHeatLevel;
  concernKind: LeadConcernKind;
};

type CenterLike = { id: string };
type BoxTypeLike = { id: string; centerId?: string };

const FIXED_LEVEL_COUNT = 4;
const DEFAULT_BALANCE_RATIO = 0.75;

const DEFAULT_AXIS_WEIGHTS: LeadScoringAxisWeights = {
  centerPriority: 3,
  boxSizePriority: 2,
  startDateUrgency: 3,
  concernPriority: 1,
  contactCompleteness: 1,
  unpaidRisk: 2,
  salesHeat: 3,
};

const AXIS_ORDER: LeadScoringAxisKey[] = [
  "centerPriority",
  "boxSizePriority",
  "startDateUrgency",
  "concernPriority",
  "contactCompleteness",
  "unpaidRisk",
  "salesHeat",
];

function getSpiderBudgetCap(vertexCount: number, maxLevel: number): number {
  return Math.max(0, vertexCount) * Math.max(0, maxLevel);
}

function buildBalancedLevels(vertexCount: number, maxLevel: number): number[] {
  if (vertexCount <= 0) return [];

  const budgetCap = getSpiderBudgetCap(vertexCount, maxLevel);
  const target = Math.round(budgetCap * DEFAULT_BALANCE_RATIO);
  const base = Math.floor(target / vertexCount);
  const remainder = Math.max(0, target - base * vertexCount);

  return Array.from({ length: vertexCount }, (_, index) =>
    clamp(base + (index < remainder ? 1 : 0), 0, maxLevel)
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getMaxLevel(levelCount: number): number {
  return Math.max(1, levelCount - 1);
}

export function scoreFromLevel(level: number, levelCount: number): number {
  const maxLevel = getMaxLevel(levelCount);
  return Math.round((clamp(level, 0, maxLevel) / maxLevel) * 100);
}

export function buildDefaultLeadScoringConfig(
  centers: CenterLike[],
  boxTypes: BoxTypeLike[]
): LeadScoringConfig {
  const levelCount = FIXED_LEVEL_COUNT;
  const maxLevel = getMaxLevel(levelCount);

  const axisWeights: LeadScoringAxisWeights = { ...DEFAULT_AXIS_WEIGHTS };
  const defaultAxisLevels = buildBalancedLevels(AXIS_ORDER.length, maxLevel);
  AXIS_ORDER.forEach((axisKey, index) => {
    axisWeights[axisKey] = defaultAxisLevels[index] ?? 0;
  });

  const defaultCenterLevels = buildBalancedLevels(centers.length, maxLevel);

  const boxTypesByCenter: Record<string, BoxTypeLike[]> = {};
  for (const center of centers) {
    boxTypesByCenter[center.id] = [];
  }

  for (const boxType of boxTypes) {
    if (!boxType.centerId || !boxTypesByCenter[boxType.centerId]) continue;
    boxTypesByCenter[boxType.centerId].push(boxType);
  }

  const boxTypePriorityLevelsByCenter: Record<string, Record<string, number>> = {};
  const centerPriorityLevels: Record<string, number> = {};

  centers.forEach((center, centerIndex) => {
    centerPriorityLevels[center.id] = defaultCenterLevels[centerIndex] ?? 0;

    const centerBoxTypes = boxTypesByCenter[center.id] ?? [];
    const defaultBoxLevels = buildBalancedLevels(centerBoxTypes.length, maxLevel);
    const nextBucket: Record<string, number> = {};
    centerBoxTypes.forEach((boxType, boxIndex) => {
      nextBucket[boxType.id] = defaultBoxLevels[boxIndex] ?? 0;
    });

    boxTypePriorityLevelsByCenter[center.id] = nextBucket;
  });

  const totalBoxVertices = Object.values(boxTypesByCenter).reduce(
    (sum, list) => sum + list.length,
    0
  );
  const maxBudget =
    getSpiderBudgetCap(AXIS_ORDER.length, maxLevel) +
    getSpiderBudgetCap(centers.length, maxLevel) +
    getSpiderBudgetCap(totalBoxVertices, maxLevel);

  return {
    levelCount,
    maxBudget,
    axisWeights,
    centerPriorityLevels,
    boxTypePriorityLevelsByCenter,
  };
}

export function getScoringPointsUsed(config: LeadScoringConfig): number {
  let used = 0;

  for (const axisKey of AXIS_ORDER) {
    used += config.axisWeights[axisKey] ?? 0;
  }

  for (const centerId of Object.keys(config.centerPriorityLevels)) {
    used += config.centerPriorityLevels[centerId] ?? 0;
  }

  for (const centerId of Object.keys(config.boxTypePriorityLevelsByCenter)) {
    const bucket = config.boxTypePriorityLevelsByCenter[centerId] ?? {};
    for (const boxTypeId of Object.keys(bucket)) {
      used += bucket[boxTypeId] ?? 0;
    }
  }

  return used;
}

export function normalizeLeadScoringConfig(
  input: Partial<LeadScoringConfig> | undefined,
  centers: CenterLike[],
  boxTypes: BoxTypeLike[]
): LeadScoringConfig {
  const base = buildDefaultLeadScoringConfig(centers, boxTypes);
  if (!input) return base;

  const levelCount = FIXED_LEVEL_COUNT;
  const maxLevel = getMaxLevel(levelCount);
  const maxBudget = base.maxBudget;

  const axisWeights: LeadScoringAxisWeights = { ...base.axisWeights };
  const requestedAxis =
    (input.axisWeights as Partial<LeadScoringAxisWeights> | undefined) ?? {};
  for (const axisKey of AXIS_ORDER) {
    const raw = requestedAxis[axisKey];
    axisWeights[axisKey] = clamp(
      typeof raw === "number" ? Math.round(raw) : axisWeights[axisKey],
      0,
      maxLevel
    );
  }

  const centerPriorityLevels: Record<string, number> = { ...base.centerPriorityLevels };
  if (input.centerPriorityLevels && typeof input.centerPriorityLevels === "object") {
    for (const centerId of Object.keys(centerPriorityLevels)) {
      const raw = input.centerPriorityLevels[centerId];
      centerPriorityLevels[centerId] = clamp(
        typeof raw === "number" ? Math.round(raw) : centerPriorityLevels[centerId],
        0,
        maxLevel
      );
    }
  }

  const boxTypePriorityLevelsByCenter: Record<string, Record<string, number>> =
    base.boxTypePriorityLevelsByCenter;

  if (input.boxTypePriorityLevelsByCenter && typeof input.boxTypePriorityLevelsByCenter === "object") {
    for (const centerId of Object.keys(boxTypePriorityLevelsByCenter)) {
      const currentCenter = boxTypePriorityLevelsByCenter[centerId] ?? {};
      const requestedCenter = input.boxTypePriorityLevelsByCenter[centerId] ?? {};
      const nextCenter: Record<string, number> = { ...currentCenter };

      for (const boxTypeId of Object.keys(currentCenter)) {
        const raw = requestedCenter[boxTypeId];
        nextCenter[boxTypeId] = clamp(
          typeof raw === "number" ? Math.round(raw) : currentCenter[boxTypeId],
          0,
          maxLevel
        );
      }

      boxTypePriorityLevelsByCenter[centerId] = nextCenter;
    }
  }

  return {
    levelCount,
    maxBudget,
    axisWeights,
    centerPriorityLevels,
    boxTypePriorityLevelsByCenter,
  };
}

export function getBudgetedLevelValue(
  config: LeadScoringConfig,
  nextValue: number,
  _currentValue: number
): number {
  const maxLevel = getMaxLevel(config.levelCount);
  return clamp(Math.round(nextValue), 0, maxLevel);
}

export function withUpdatedLevelCount(
  config: LeadScoringConfig,
  _nextLevelCount: number,
  centers: CenterLike[],
  boxTypes: BoxTypeLike[]
): LeadScoringConfig {
  return normalizeLeadScoringConfig(config, centers, boxTypes);
}

export function heatToScore(heat: SalesHeatLevel): number {
  if (heat === "hot") return 100;
  if (heat === "warm") return 58;
  return 28;
}

export function heatMeta(heat: SalesHeatLevel, fr: boolean): { label: string; bg: string; text: string } {
  if (heat === "hot") {
    return {
      label: fr ? "Chaud" : "Hot",
      bg: "rgba(239,68,68,0.18)",
      text: "#b91c1c",
    };
  }

  if (heat === "warm") {
    return {
      label: fr ? "Tiède" : "Warm",
      bg: "rgba(249,115,22,0.18)",
      text: "#c2410c",
    };
  }

  return {
    label: fr ? "Froid" : "Cold",
    bg: "rgba(234,179,8,0.18)",
    text: "#a16207",
  };
}

export function concernToScore(concernKind: LeadConcernKind): number {
  if (concernKind === "company") return 82;
  if (concernKind === "self") return 72;
  return 48;
}

export function concernLabel(concernKind: LeadConcernKind, fr: boolean): string {
  if (concernKind === "company") return fr ? "Société" : "Company";
  if (concernKind === "self") return fr ? "Lui-même" : "Self";
  return fr ? "Tiers" : "Third party";
}

export function weightedAverage(values: Array<{ score: number; weight: number }>): number {
  const active = values.filter((item) => item.weight > 0);
  if (active.length === 0) {
    return 0;
  }

  const denominator = active.reduce((sum, item) => sum + item.weight, 0);
  if (denominator <= 0) return 0;

  const numerator = active.reduce((sum, item) => sum + item.score * item.weight, 0);
  return Math.round(numerator / denominator);
}
