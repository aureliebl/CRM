import type {
  Booking,
  DashboardCenterRow,
  DashboardStats,
  Trend,
} from "@/lib/types";
import { centers } from "./centers-and-pricing";

const bookings: Booking[] = [
  {
    id: "b1",
    clientId: "c1",
    channel: "marketplace",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-1m2",
    status: "confirmed",
    createdAt: "2024-02-10T09:30:00Z",
    checkIn: "2024-02-15T10:00:00Z",
    amount: 59,
    source: "web",
  },
  {
    id: "b2",
    clientId: "c2",
    channel: "kostok",
    centerId: "ctr-lyon-02",
    boxTypeId: "bx-lyon-02-3m2",
    status: "new",
    createdAt: "2024-02-12T14:45:00Z",
    checkIn: "2024-03-01T09:00:00Z",
    amount: 129,
    source: "phone",
  },
  {
    id: "b3",
    channel: "marketplace",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-3m2",
    status: "cancelled",
    createdAt: "2024-02-08T11:10:00Z",
    amount: 0,
    source: "web",
  },
  {
    id: "b4",
    clientId: "c3",
    channel: "marketplace",
    centerId: "ctr-marseille-03",
    boxTypeId: "bx-marseille-03-2m2",
    status: "new",
    createdAt: "2024-02-13T08:15:00Z",
    checkIn: "2024-03-01T09:30:00Z",
    amount: 88,
    source: "web",
  },
  {
    id: "b5",
    clientId: "c4",
    channel: "kostok",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-4m2",
    status: "confirmed",
    createdAt: "2024-02-02T11:00:00Z",
    checkIn: "2024-02-05T09:00:00Z",
    amount: 126,
    source: "phone",
  },
  {
    id: "b6",
    clientId: "c6",
    channel: "kostok",
    centerId: "ctr-lille-05",
    boxTypeId: "bx-lille-05-2m2",
    status: "confirmed",
    createdAt: "2024-02-07T10:40:00Z",
    checkIn: "2024-02-08T08:30:00Z",
    amount: 74,
    source: "partner",
  },
  {
    id: "b7",
    clientId: "c6",
    channel: "kostok",
    centerId: "ctr-lille-05",
    boxTypeId: "bx-lille-05-7m2",
    status: "new",
    createdAt: "2024-02-12T12:10:00Z",
    checkIn: "2024-02-20T09:30:00Z",
    amount: 199,
    source: "phone",
  },
  {
    id: "b8",
    clientId: "c7",
    channel: "marketplace",
    centerId: "ctr-toulouse-06",
    boxTypeId: "bx-toulouse-06-3m2",
    status: "confirmed",
    createdAt: "2024-02-15T14:25:00Z",
    checkIn: "2024-02-16T09:00:00Z",
    amount: 101,
    source: "web",
  },
  {
    id: "b9",
    clientId: "c8",
    channel: "kostok",
    centerId: "ctr-marseille-03",
    boxTypeId: "bx-marseille-03-5m2",
    status: "confirmed",
    createdAt: "2024-02-01T07:50:00Z",
    checkIn: "2024-02-03T10:00:00Z",
    amount: 155,
    source: "partner",
  },
  {
    id: "b10",
    clientId: "c9",
    channel: "marketplace",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-1m2",
    status: "expired",
    createdAt: "2024-01-30T16:30:00Z",
    amount: 52,
    source: "web",
  },
  {
    id: "b11",
    clientId: "c10",
    channel: "kostok",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-1m2",
    status: "confirmed",
    createdAt: "2024-02-05T09:20:00Z",
    checkIn: "2024-02-06T09:00:00Z",
    amount: 59,
    source: "phone",
  },
  {
    id: "b12",
    clientId: "c11",
    channel: "marketplace",
    centerId: "ctr-lyon-02",
    boxTypeId: "bx-lyon-02-6m2",
    status: "new",
    createdAt: "2024-02-16T08:45:00Z",
    checkIn: "2024-03-02T09:00:00Z",
    amount: 182,
    source: "web",
  },
  {
    id: "b13",
    clientId: "c12",
    channel: "kostok",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-4m2",
    status: "confirmed",
    createdAt: "2024-02-03T11:10:00Z",
    checkIn: "2024-02-04T08:45:00Z",
    amount: 126,
    source: "partner",
  },
  {
    id: "b14",
    clientId: "c1",
    channel: "marketplace",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-3m2",
    status: "expired",
    createdAt: "2024-01-18T10:10:00Z",
    amount: 109,
    source: "web",
  },
  {
    id: "b15",
    clientId: "c2",
    channel: "kostok",
    centerId: "ctr-lyon-02",
    boxTypeId: "bx-lyon-02-6m2",
    status: "confirmed",
    createdAt: "2024-02-10T17:15:00Z",
    checkIn: "2024-02-12T10:30:00Z",
    amount: 182,
    source: "phone",
  },
  {
    id: "b16",
    channel: "marketplace",
    centerId: "ctr-lille-05",
    boxTypeId: "bx-lille-05-2m2",
    status: "cancelled",
    createdAt: "2024-02-09T13:55:00Z",
    amount: 0,
    source: "partner",
  },
  {
    id: "b17",
    clientId: "c4",
    channel: "marketplace",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-1m2",
    status: "confirmed",
    createdAt: "2024-02-14T10:05:00Z",
    checkIn: "2024-02-15T09:00:00Z",
    amount: 52,
    source: "web",
  },
  {
    id: "b18",
    clientId: "c7",
    channel: "marketplace",
    centerId: "ctr-toulouse-06",
    boxTypeId: "bx-toulouse-06-6m2",
    status: "new",
    createdAt: "2024-02-17T09:40:00Z",
    checkIn: "2024-03-10T09:00:00Z",
    amount: 172,
    source: "web",
  },
  {
    id: "b19",
    clientId: "c8",
    channel: "kostok",
    centerId: "ctr-marseille-03",
    boxTypeId: "bx-marseille-03-2m2",
    status: "confirmed",
    createdAt: "2024-02-04T08:20:00Z",
    checkIn: "2024-02-05T09:15:00Z",
    amount: 88,
    source: "phone",
  },
  {
    id: "b20",
    clientId: "c10",
    channel: "kostok",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-3m2",
    status: "expired",
    createdAt: "2024-01-22T10:50:00Z",
    amount: 129,
    source: "partner",
  },
  {
    id: "b21",
    clientId: "c12",
    channel: "kostok",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-1m2",
    status: "new",
    createdAt: "2024-02-18T15:00:00Z",
    checkIn: "2024-03-04T10:00:00Z",
    amount: 52,
    source: "phone",
  },
  {
    id: "b22",
    clientId: "c3",
    channel: "marketplace",
    centerId: "ctr-marseille-03",
    boxTypeId: "bx-marseille-03-5m2",
    status: "confirmed",
    createdAt: "2024-02-06T13:15:00Z",
    checkIn: "2024-02-07T09:00:00Z",
    amount: 155,
    source: "web",
  },
];

const generatedBookingCenters = [
  "ctr-paris-01",
  "ctr-lyon-02",
  "ctr-marseille-03",
  "ctr-bordeaux-04",
  "ctr-lille-05",
  "ctr-toulouse-06",
] as const;

const generatedBookingBoxTypes = [
  "bx-paris-01-1m2",
  "bx-paris-01-3m2",
  "bx-lyon-02-3m2",
  "bx-lyon-02-6m2",
  "bx-marseille-03-2m2",
  "bx-marseille-03-5m2",
  "bx-bordeaux-04-1m2",
  "bx-bordeaux-04-4m2",
  "bx-lille-05-2m2",
  "bx-lille-05-7m2",
  "bx-toulouse-06-3m2",
  "bx-toulouse-06-6m2",
] as const;

const generatedBookingAmounts = [52, 59, 74, 88, 101, 109, 126, 129, 155, 172, 182, 199] as const;

for (let index = 23; index <= 140; index++) {
  const centerId = generatedBookingCenters[index % generatedBookingCenters.length];
  const createdAt = new Date(Date.UTC(2024, 0 + (index % 2), 1 + (index % 27), 7 + (index % 10), 15, 0)).toISOString();
  const status =
    index % 9 === 0
      ? "cancelled"
      : index % 7 === 0
      ? "expired"
      : index % 2 === 0
      ? "confirmed"
      : "new";

  bookings.push({
    id: `b${index}`,
    clientId: `c${1 + (index % 52)}`,
    channel: index % 3 === 0 ? "marketplace" : "kostok",
    centerId,
    boxTypeId: generatedBookingBoxTypes[index % generatedBookingBoxTypes.length],
    status,
    createdAt,
    checkIn:
      status === "cancelled" || status === "expired"
        ? undefined
        : new Date(Date.UTC(2024, 1 + (index % 2), 1 + (index % 27), 9, 0, 0)).toISOString(),
    amount: status === "cancelled" ? 0 : generatedBookingAmounts[index % generatedBookingAmounts.length],
    source: index % 3 === 0 ? "web" : index % 3 === 1 ? "phone" : "partner",
  });
}

let sortedBookingsCache: Booking[] | null = null;

function getSortedBookings(): Booking[] {
  if (sortedBookingsCache) return sortedBookingsCache;
  sortedBookingsCache = bookings
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return sortedBookingsCache;
}

export function getBookings(): Booking[] {
  return getSortedBookings();
}

export function getDashboardStats(): DashboardStats {
  const periodLabel = "30 derniers jours";

  let revenueMarketplace = 0;
  let revenueKostok = 0;

  bookings.forEach((b) => {
    if (b.status === "cancelled") return;
    if (b.channel === "marketplace") revenueMarketplace += b.amount;
    else revenueKostok += b.amount;
  });

  const totalRevenue = revenueMarketplace + revenueKostok;
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed")
    .length;
  const conversionRate =
    totalBookings === 0 ? 0 : Math.round((confirmedBookings / totalBookings) * 100);

  const kpis = [
    {
      label: "Chiffre d’affaires total",
      value: `${totalRevenue.toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      })}`,
      delta: "+12% vs période précédente",
      trend: "up" as Trend,
      breakdown: {
        marketplace: `${revenueMarketplace.toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        })}`,
        kostok: `${revenueKostok.toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        })}`,
      },
    },
    {
      label: "Bookings (tous canaux)",
      value: `${totalBookings}`,
      delta: "+5% vs période précédente",
      trend: "up" as Trend,
    },
    {
      label: "Taux de conversion",
      value: `${conversionRate}%`,
      delta: "+2 pts",
      trend: "up" as Trend,
    },
  ];

  const centersRows: DashboardCenterRow[] = centers.map((c, index) => {
    const centerBookings = bookings.filter((b) => b.centerId === c.id);
    const revenueMkt = centerBookings
      .filter((b) => b.channel === "marketplace" && b.status !== "cancelled")
      .reduce((sum, b) => sum + b.amount, 0);
    const revenueKsk = centerBookings
      .filter((b) => b.channel === "kostok" && b.status !== "cancelled")
      .reduce((sum, b) => sum + b.amount, 0);

    const occupancyRate = 65 + index * 10;
    const trend: Trend = occupancyRate > 70 ? "up" : "stable";

    return {
      centerId: c.id,
      centerName: c.name,
      city: c.city,
      occupancyRate,
      revenueMarketplace: revenueMkt,
      revenueKostok: revenueKsk,
      trend,
    };
  });

  return {
    periodLabel,
    kpis,
    centers: centersRows,
  };
}

