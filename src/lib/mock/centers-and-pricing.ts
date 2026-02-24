import type {
  Center,
  BoxType,
  BoxPricing,
  BoxPricingHistoryPoint,
  Trend,
} from "@/lib/types";

export const centers: Center[] = [
  {
    id: "ctr-paris-01",
    name: "Costockage Paris 01",
    city: "Paris",
    code: "PAR-01",
    isKostokOwned: true,
    latitude: 48.8566,
    longitude: 2.3522,
    address: "12 rue de Rivoli, 75001 Paris",
    floors: 3,
    totalBoxes: 120,
    phone: "+33 1 42 33 44 55",
    openingHours: "Lun-Sam 7h-21h, Dim 9h-18h",
    manager: "Sophie Laurent",
  },
  {
    id: "ctr-lyon-02",
    name: "Centre partenaire Lyon 02",
    city: "Lyon",
    code: "LYO-02",
    isKostokOwned: false,
    latitude: 45.764,
    longitude: 4.8357,
    address: "45 avenue Jean Jaurès, 69007 Lyon",
    floors: 2,
    totalBoxes: 85,
    phone: "+33 4 72 11 22 33",
    openingHours: "Lun-Sam 8h-20h",
    manager: "Marc Dubois",
  },
  {
    id: "ctr-marseille-03",
    name: "Costockage Marseille 03",
    city: "Marseille",
    code: "MRS-03",
    isKostokOwned: true,
    latitude: 43.2965,
    longitude: 5.3698,
    address: "8 boulevard Michelet, 13008 Marseille",
    floors: 2,
    totalBoxes: 95,
    phone: "+33 4 91 55 66 77",
    openingHours: "Lun-Sam 7h-21h, Dim 9h-17h",
    manager: "Isabelle Roche",
  },
  {
    id: "ctr-bordeaux-04",
    name: "Centre partenaire Bordeaux 04",
    city: "Bordeaux",
    code: "BDX-04",
    isKostokOwned: false,
    latitude: 44.8378,
    longitude: -0.5792,
    address: "22 cours de la Marne, 33000 Bordeaux",
    floors: 2,
    totalBoxes: 78,
    phone: "+33 5 56 44 55 66",
    openingHours: "Lun-Ven 8h-19h, Sam 9h-17h",
    manager: "Pierre Vignoble",
  },
  {
    id: "ctr-lille-05",
    name: "Costockage Lille 05",
    city: "Lille",
    code: "LIL-05",
    isKostokOwned: true,
    latitude: 50.6292,
    longitude: 3.0573,
    address: "15 rue Faidherbe, 59000 Lille",
    floors: 3,
    totalBoxes: 110,
    phone: "+33 3 20 88 99 00",
    openingHours: "Lun-Sam 7h-21h, Dim 10h-16h",
    manager: "François Leroy",
  },
  {
    id: "ctr-toulouse-06",
    name: "Centre partenaire Toulouse 06",
    city: "Toulouse",
    code: "TLS-06",
    isKostokOwned: false,
    latitude: 43.6047,
    longitude: 1.4442,
    address: "30 allées Jean Jaurès, 31000 Toulouse",
    floors: 2,
    totalBoxes: 72,
    phone: "+33 5 61 22 33 44",
    openingHours: "Lun-Ven 8h-20h, Sam 9h-18h",
    manager: "Claire Martin",
  },
];

export const boxTypes: BoxType[] = [
  {
    id: "bx-paris-01-1m2",
    name: "Box XS 1m²",
    sizeM2: 1,
    heightM: 2.2,
    centerId: "ctr-paris-01",
    basePrice: 49,
    features: ["Intérieur", "RDC"],
  },
  {
    id: "bx-paris-01-3m2",
    name: "Box M 3m²",
    sizeM2: 3,
    heightM: 2.6,
    centerId: "ctr-paris-01",
    basePrice: 109,
    features: ["Intérieur", "Étage"],
  },
  {
    id: "bx-lyon-02-3m2",
    name: "Box M 3m²",
    sizeM2: 3,
    heightM: 2.5,
    centerId: "ctr-lyon-02",
    basePrice: 99,
    features: ["Extérieur"],
  },
  {
    id: "bx-lyon-02-6m2",
    name: "Box XL 6m²",
    sizeM2: 6,
    heightM: 2.8,
    centerId: "ctr-lyon-02",
    basePrice: 169,
    features: ["Intérieur", "Accès 24/7"],
  },
  {
    id: "bx-marseille-03-2m2",
    name: "Box S 2m²",
    sizeM2: 2,
    heightM: 2.3,
    centerId: "ctr-marseille-03",
    basePrice: 79,
    features: ["RDC", "Vidéosurveillance"],
  },
  {
    id: "bx-marseille-03-5m2",
    name: "Box L 5m²",
    sizeM2: 5,
    heightM: 2.7,
    centerId: "ctr-marseille-03",
    basePrice: 149,
    features: ["Intérieur", "Accès 24/7"],
  },
  {
    id: "bx-bordeaux-04-1m2",
    name: "Box XS 1m²",
    sizeM2: 1,
    heightM: 2.0,
    centerId: "ctr-bordeaux-04",
    basePrice: 45,
    features: ["Extérieur"],
  },
  {
    id: "bx-bordeaux-04-4m2",
    name: "Box M+ 4m²",
    sizeM2: 4,
    heightM: 2.5,
    centerId: "ctr-bordeaux-04",
    basePrice: 119,
    features: ["Intérieur", "Plain-pied"],
  },
  {
    id: "bx-lille-05-2m2",
    name: "Box S 2m²",
    sizeM2: 2,
    heightM: 2.4,
    centerId: "ctr-lille-05",
    basePrice: 69,
    features: ["Intérieur", "Tempéré"],
  },
  {
    id: "bx-lille-05-7m2",
    name: "Box XXL 7m²",
    sizeM2: 7,
    heightM: 3.0,
    centerId: "ctr-lille-05",
    basePrice: 189,
    features: ["Accès 24/7", "Quai de chargement"],
  },
  {
    id: "bx-toulouse-06-3m2",
    name: "Box M 3m²",
    sizeM2: 3,
    heightM: 2.5,
    centerId: "ctr-toulouse-06",
    basePrice: 95,
    features: ["Extérieur", "Parking"],
  },
  {
    id: "bx-toulouse-06-6m2",
    name: "Box XL 6m²",
    sizeM2: 6,
    heightM: 2.8,
    centerId: "ctr-toulouse-06",
    basePrice: 165,
    features: ["Intérieur", "Accès camion"],
  },
];

let pricingHistory: Record<string, BoxPricingHistoryPoint[]> = {};

const initialPricing: BoxPricing[] = [
  {
    id: "pr-paris-01-1m2",
    boxTypeId: "bx-paris-01-1m2",
    centerId: "ctr-paris-01",
    currentPrice: 59,
    referencePrice: 49,
    availabilityCount: 3,
    totalUnits: 10,
    trend: "down",
    lastUpdated: "2024-02-10T10:00:00Z",
    history: [],
  },
  {
    id: "pr-paris-01-3m2",
    boxTypeId: "bx-paris-01-3m2",
    centerId: "ctr-paris-01",
    currentPrice: 129,
    referencePrice: 109,
    availabilityCount: 1,
    totalUnits: 8,
    trend: "down",
    lastUpdated: "2024-02-09T15:30:00Z",
    history: [],
  },
  {
    id: "pr-lyon-02-3m2",
    boxTypeId: "bx-lyon-02-3m2",
    centerId: "ctr-lyon-02",
    currentPrice: 105,
    referencePrice: 99,
    availabilityCount: 5,
    totalUnits: 12,
    trend: "up",
    lastUpdated: "2024-02-08T09:45:00Z",
    history: [],
  },
  {
    id: "pr-lyon-02-6m2",
    boxTypeId: "bx-lyon-02-6m2",
    centerId: "ctr-lyon-02",
    currentPrice: 182,
    referencePrice: 169,
    availabilityCount: 4,
    totalUnits: 9,
    trend: "up",
    lastUpdated: "2024-02-11T10:15:00Z",
    history: [],
  },
  {
    id: "pr-marseille-03-2m2",
    boxTypeId: "bx-marseille-03-2m2",
    centerId: "ctr-marseille-03",
    currentPrice: 88,
    referencePrice: 79,
    availabilityCount: 6,
    totalUnits: 14,
    trend: "up",
    lastUpdated: "2024-02-12T08:20:00Z",
    history: [],
  },
  {
    id: "pr-marseille-03-5m2",
    boxTypeId: "bx-marseille-03-5m2",
    centerId: "ctr-marseille-03",
    currentPrice: 155,
    referencePrice: 149,
    availabilityCount: 3,
    totalUnits: 10,
    trend: "stable",
    lastUpdated: "2024-02-09T17:00:00Z",
    history: [],
  },
  {
    id: "pr-bordeaux-04-1m2",
    boxTypeId: "bx-bordeaux-04-1m2",
    centerId: "ctr-bordeaux-04",
    currentPrice: 52,
    referencePrice: 45,
    availabilityCount: 9,
    totalUnits: 18,
    trend: "up",
    lastUpdated: "2024-02-10T12:40:00Z",
    history: [],
  },
  {
    id: "pr-bordeaux-04-4m2",
    boxTypeId: "bx-bordeaux-04-4m2",
    centerId: "ctr-bordeaux-04",
    currentPrice: 126,
    referencePrice: 119,
    availabilityCount: 4,
    totalUnits: 11,
    trend: "up",
    lastUpdated: "2024-02-12T15:05:00Z",
    history: [],
  },
  {
    id: "pr-lille-05-2m2",
    boxTypeId: "bx-lille-05-2m2",
    centerId: "ctr-lille-05",
    currentPrice: 74,
    referencePrice: 69,
    availabilityCount: 7,
    totalUnits: 16,
    trend: "stable",
    lastUpdated: "2024-02-11T09:30:00Z",
    history: [],
  },
  {
    id: "pr-lille-05-7m2",
    boxTypeId: "bx-lille-05-7m2",
    centerId: "ctr-lille-05",
    currentPrice: 199,
    referencePrice: 189,
    availabilityCount: 2,
    totalUnits: 8,
    trend: "up",
    lastUpdated: "2024-02-07T14:20:00Z",
    history: [],
  },
  {
    id: "pr-toulouse-06-3m2",
    boxTypeId: "bx-toulouse-06-3m2",
    centerId: "ctr-toulouse-06",
    currentPrice: 101,
    referencePrice: 95,
    availabilityCount: 8,
    totalUnits: 15,
    trend: "up",
    lastUpdated: "2024-02-13T07:55:00Z",
    history: [],
  },
  {
    id: "pr-toulouse-06-6m2",
    boxTypeId: "bx-toulouse-06-6m2",
    centerId: "ctr-toulouse-06",
    currentPrice: 172,
    referencePrice: 165,
    availabilityCount: 5,
    totalUnits: 12,
    trend: "stable",
    lastUpdated: "2024-02-12T13:15:00Z",
    history: [],
  },
];

let pricing: BoxPricing[] = initialPricing.map((p) => ({
  ...p,
  history:
    pricingHistory[p.id] ??
    [
      {
        date: "2024-01-10T09:00:00Z",
        price: p.referencePrice,
        availabilityCount: p.totalUnits - p.availabilityCount,
      },
      {
        date: "2024-02-01T09:00:00Z",
        price: (p.referencePrice + p.currentPrice) / 2,
        availabilityCount: p.totalUnits - p.availabilityCount - 1,
      },
      {
        date: p.lastUpdated,
        price: p.currentPrice,
        availabilityCount: p.totalUnits - p.availabilityCount,
      },
    ],
}));

export function getCenters(): Center[] {
  return centers;
}

export function getBoxTypesByCenter(centerId?: string): BoxType[] {
  if (!centerId) return boxTypes;
  return boxTypes.filter((b) => b.centerId === centerId);
}

export function getPricingByCenter(centerId?: string): BoxPricing[] {
  if (!centerId) return pricing;
  return pricing.filter((p) => p.centerId === centerId);
}

export function updatePricing(
  pricingId: string,
  newPrice: number
): BoxPricing | undefined {
  const existing = pricing.find((p) => p.id === pricingId);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const history: BoxPricingHistoryPoint[] = [
    ...existing.history,
    {
      date: now,
      price: newPrice,
      availabilityCount: existing.availabilityCount,
    },
  ];

  const lastTwo = history.slice(-2);
  let trend: Trend = "stable";
  if (lastTwo.length === 2) {
    const [prev, last] = lastTwo;
    if (last.price > prev.price) trend = "up";
    else if (last.price < prev.price) trend = "down";
  }

  const updated: BoxPricing = {
    ...existing,
    currentPrice: newPrice,
    lastUpdated: now,
    trend,
    history,
  };

  pricing = pricing.map((p) => (p.id === pricingId ? updated : p));
  pricingHistory[pricingId] = history;

  return updated;
}

export function bulkUpdatePricing(
  pricingIds: string[],
  action:
    | { type: "percent"; deltaPercent: number }
    | { type: "absolute"; deltaAmount: number }
    | { type: "alignToReference" }
): BoxPricing[] {
  const updated: BoxPricing[] = [];

  pricingIds.forEach((id) => {
    const current = pricing.find((p) => p.id === id);
    if (!current) return;

    let newPrice = current.currentPrice;
    if (action.type === "percent") {
      newPrice = Math.round(
        (current.currentPrice * (1 + action.deltaPercent / 100)) * 100
      ) / 100;
    } else if (action.type === "absolute") {
      newPrice = Math.max(0, current.currentPrice + action.deltaAmount);
    } else if (action.type === "alignToReference") {
      newPrice = current.referencePrice;
    }

    const result = updatePricing(id, newPrice);
    if (result) {
      updated.push(result);
    }
  });

  return updated;
}

