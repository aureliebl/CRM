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

const DEFAULT_BUDGET = 100;

const DEFAULT_AXIS_WEIGHTS: LeadScoringAxisWeights = {
  centerPriority: 2,
  boxSizePriority: 2,
  startDateUrgency: 2,
  concernPriority: 1,
  contactCompleteness: 1,
  unpaidRisk: 1,
  salesHeat: 2,
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
  const centerPriorityLevels: Record<string, number> = {};
  const boxTypePriorityLevelsByCenter: Record<string, Record<string, number>> = {};

  for (const center of centers) {
    centerPriorityLevels[center.id] = 0;
    boxTypePriorityLevelsByCenter[center.id] = {};
  }

  for (const boxType of boxTypes) {
    if (!boxType.centerId) continue;
    if (!boxTypePriorityLevelsByCenter[boxType.centerId]) {
      boxTypePriorityLevelsByCenter[boxType.centerId] = {};
    }
    boxTypePriorityLevelsByCenter[boxType.centerId][boxType.id] = 0;
  }

  return {
    levelCount: 3,
    maxBudget: DEFAULT_BUDGET,
    axisWeights: { ...DEFAULT_AXIS_WEIGHTS },
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

function scaleLevels(levels: number[], maxBudget: number): number[] {
  const currentTotal = levels.reduce((sum, value) => sum + value, 0);
  if (currentTotal <= maxBudget || currentTotal === 0) return levels;

  const ratio = maxBudget / currentTotal;
  const scaled = levels.map((value) => Math.floor(value * ratio));
  let used = scaled.reduce((sum, value) => sum + value, 0);

  if (used >= maxBudget) return scaled;

  const mutable = scaled.slice();
  const indexed = levels
    .map((value, index) => ({ index, value }))
    .sort((left, right) => right.value - left.value);

  let cursor = 0;
  while (used < maxBudget && indexed.length > 0) {
    const item = indexed[cursor % indexed.length];
    mutable[item.index] += 1;
    used += 1;
    cursor += 1;
  }

  return mutable;
}

export function normalizeLeadScoringConfig(
  input: Partial<LeadScoringConfig> | undefined,
  centers: CenterLike[],
  boxTypes: BoxTypeLike[]
): LeadScoringConfig {
  const base = buildDefaultLeadScoringConfig(centers, boxTypes);
  if (!input) return base;

  const requestedLevelCount =
    typeof input.levelCount === "number" ? Math.round(input.levelCount) : base.levelCount;
  const levelCount = clamp(requestedLevelCount, 2, 7);
  const maxLevel = getMaxLevel(levelCount);

  const requestedBudget =
    typeof input.maxBudget === "number" ? Math.round(input.maxBudget) : base.maxBudget;
  const maxBudget = clamp(requestedBudget, 20, 500);

  const axisWeights: LeadScoringAxisWeights = { ...base.axisWeights };
  const requestedAxis =
    (input.axisWeights as Partial<LeadScoringAxisWeights> | undefined) ?? {};
  for (const axisKey of AXIS_ORDER) {
    const raw = requestedAxis[axisKey];
    axisWeights[axisKey] = clamp(typeof raw === "number" ? Math.round(raw) : axisWeights[axisKey], 0, maxLevel);
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

  const flat: number[] = [];
  for (const axisKey of AXIS_ORDER) flat.push(axisWeights[axisKey]);
  for (const centerId of Object.keys(centerPriorityLevels)) flat.push(centerPriorityLevels[centerId]);
  for (const centerId of Object.keys(boxTypePriorityLevelsByCenter)) {
    const bucket = boxTypePriorityLevelsByCenter[centerId] ?? {};
    for (const boxTypeId of Object.keys(bucket)) {
      flat.push(bucket[boxTypeId]);
    }
  }

  const scaled = scaleLevels(flat, maxBudget);
  let cursor = 0;

  for (const axisKey of AXIS_ORDER) {
    axisWeights[axisKey] = scaled[cursor] ?? 0;
    cursor += 1;
  }

  for (const centerId of Object.keys(centerPriorityLevels)) {
    centerPriorityLevels[centerId] = scaled[cursor] ?? 0;
    cursor += 1;
  }

  for (const centerId of Object.keys(boxTypePriorityLevelsByCenter)) {
    const bucket = boxTypePriorityLevelsByCenter[centerId] ?? {};
    const nextBucket: Record<string, number> = {};
    for (const boxTypeId of Object.keys(bucket)) {
      nextBucket[boxTypeId] = scaled[cursor] ?? 0;
      cursor += 1;
    }
    boxTypePriorityLevelsByCenter[centerId] = nextBucket;
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
  currentValue: number
): number {
  const maxLevel = getMaxLevel(config.levelCount);
  const target = clamp(Math.round(nextValue), 0, maxLevel);
  const usedWithoutCurrent = getScoringPointsUsed(config) - currentValue;
  const allowance = Math.max(0, config.maxBudget - usedWithoutCurrent);
  return Math.min(target, allowance);
}

export function withUpdatedLevelCount(
  config: LeadScoringConfig,
  nextLevelCount: number,
  centers: CenterLike[],
  boxTypes: BoxTypeLike[]
): LeadScoringConfig {
  const nextCount = clamp(Math.round(nextLevelCount), 2, 7);
  if (nextCount === config.levelCount) {
    return config;
  }

  const oldMax = getMaxLevel(config.levelCount);
  const newMax = getMaxLevel(nextCount);

  const remap = (value: number) => {
    if (oldMax <= 0) return clamp(value, 0, newMax);
    return clamp(Math.round((value / oldMax) * newMax), 0, newMax);
  };

  const nextRaw: LeadScoringConfig = {
    ...config,
    levelCount: nextCount,
    axisWeights: {
      centerPriority: remap(config.axisWeights.centerPriority),
      boxSizePriority: remap(config.axisWeights.boxSizePriority),
      startDateUrgency: remap(config.axisWeights.startDateUrgency),
      concernPriority: remap(config.axisWeights.concernPriority),
      contactCompleteness: remap(config.axisWeights.contactCompleteness),
      unpaidRisk: remap(config.axisWeights.unpaidRisk),
      salesHeat: remap(config.axisWeights.salesHeat),
    },
    centerPriorityLevels: Object.fromEntries(
      Object.entries(config.centerPriorityLevels).map(([centerId, value]) => [centerId, remap(value)])
    ),
    boxTypePriorityLevelsByCenter: Object.fromEntries(
      Object.entries(config.boxTypePriorityLevelsByCenter).map(([centerId, bucket]) => [
        centerId,
        Object.fromEntries(
          Object.entries(bucket).map(([boxTypeId, value]) => [boxTypeId, remap(value)])
        ),
      ])
    ),
  };

  return normalizeLeadScoringConfig(nextRaw, centers, boxTypes);
}

export function heatToScore(heat: SalesHeatLevel): number {
  if (heat === "hot") return 100;
  if (heat === "warm") return 65;
  return 35;
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
  if (concernKind === "company") return 85;
  if (concernKind === "self") return 70;
  return 55;
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
