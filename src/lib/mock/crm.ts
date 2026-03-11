import type {
  Contract,
  ContractStatus,
  Invoice,
  InvoiceStatus,
  IndividualBox,
  IndividualBoxStatus,
  QuoteRequest,
  UnfinishedBooking,
  Conversation,
  ConversationMessage,
  ClientHistoryEvent,
  ClientHistoryType,
  PricingTier,
  LeadSource,
  Trend,
} from "@/lib/types";
import { centers, boxTypes } from "./centers-and-pricing";
import { getClients } from "./clients";

// ────────────────────────────────────────────────────────────
// CONTRACTS
// ────────────────────────────────────────────────────────────

const contractStatuses: ContractStatus[] = ["actif", "terminé", "impayé", "squatteur"];
const promoCodes = ["WELCOME10", "SUMMER20", "PARRAIN15", "BF30", "FIDELITE10", null, null, null];

const handCraftedContracts: Contract[] = [
  {
    id: "ctr-001", clientId: "c1", centerId: "ctr-paris-01", boxId: "box-par01-A03",
    boxTypeId: "bx-paris-01-1m2", status: "actif", monthlyRent: 59,
    promoCode: "WELCOME10", promoEndDate: "2024-06-15",
    startDate: "2024-01-15T10:00:00Z", contractUrl: "/documents/contrat-001.pdf",
  },
  {
    id: "ctr-002", clientId: "c2", centerId: "ctr-lyon-02", boxId: "box-lyo02-B05",
    boxTypeId: "bx-lyon-02-3m2", status: "actif", monthlyRent: 129,
    priceIncreaseAmount: 10, priceIncreaseDate: "2025-07-01",
    startDate: "2023-11-10T09:00:00Z", contractUrl: "/documents/contrat-002.pdf",
  },
  {
    id: "ctr-003", clientId: "c2", centerId: "ctr-lyon-02", boxId: "box-lyo02-C12",
    boxTypeId: "bx-lyon-02-6m2", status: "impayé", monthlyRent: 182,
    startDate: "2024-02-12T10:30:00Z", contractUrl: "/documents/contrat-003.pdf",
  },
  {
    id: "ctr-004", clientId: "c3", centerId: "ctr-marseille-03", boxId: "box-mrs03-A08",
    boxTypeId: "bx-marseille-03-2m2", status: "actif", monthlyRent: 88,
    promoCode: "SUMMER20", promoEndDate: "2024-09-01",
    startDate: "2024-03-01T09:30:00Z", contractUrl: "/documents/contrat-004.pdf",
  },
  {
    id: "ctr-005", clientId: "c4", centerId: "ctr-bordeaux-04", boxId: "box-bdx04-B02",
    boxTypeId: "bx-bordeaux-04-4m2", status: "actif", monthlyRent: 126,
    startDate: "2024-01-03T08:00:00Z", contractUrl: "/documents/contrat-005.pdf",
  },
  {
    id: "ctr-006", clientId: "c5", centerId: "ctr-paris-01", boxId: "box-par01-B10",
    boxTypeId: "bx-paris-01-3m2", status: "terminé", monthlyRent: 109,
    startDate: "2023-06-10T10:00:00Z", endDate: "2023-12-31T10:00:00Z",
    contractUrl: "/documents/contrat-006.pdf",
  },
  {
    id: "ctr-007", clientId: "c6", centerId: "ctr-lille-05", boxId: "box-lil05-A04",
    boxTypeId: "bx-lille-05-2m2", status: "impayé", monthlyRent: 74,
    startDate: "2024-01-08T09:00:00Z", contractUrl: "/documents/contrat-007.pdf",
  },
  {
    id: "ctr-008", clientId: "c6", centerId: "ctr-lille-05", boxId: "box-lil05-C01",
    boxTypeId: "bx-lille-05-7m2", status: "actif", monthlyRent: 199,
    priceIncreaseAmount: 15, priceIncreaseDate: "2025-03-01",
    startDate: "2024-02-01T09:00:00Z", contractUrl: "/documents/contrat-008.pdf",
  },
  {
    id: "ctr-009", clientId: "c7", centerId: "ctr-toulouse-06", boxId: "box-tls06-A06",
    boxTypeId: "bx-toulouse-06-3m2", status: "actif", monthlyRent: 101,
    promoCode: "FIDELITE10", promoEndDate: "2025-02-15",
    startDate: "2024-02-15T09:00:00Z", contractUrl: "/documents/contrat-009.pdf",
  },
  {
    id: "ctr-010", clientId: "c8", centerId: "ctr-marseille-03", boxId: "box-mrs03-B03",
    boxTypeId: "bx-marseille-03-5m2", status: "actif", monthlyRent: 155,
    startDate: "2023-12-20T09:00:00Z", contractUrl: "/documents/contrat-010.pdf",
  },
  {
    id: "ctr-011", clientId: "c8", centerId: "ctr-marseille-03", boxId: "box-mrs03-A15",
    boxTypeId: "bx-marseille-03-2m2", status: "squatteur", monthlyRent: 88,
    startDate: "2023-09-01T09:00:00Z", endDate: "2024-01-31T09:00:00Z",
    contractUrl: "/documents/contrat-011.pdf",
  },
  {
    id: "ctr-012", clientId: "c10", centerId: "ctr-paris-01", boxId: "box-par01-A09",
    boxTypeId: "bx-paris-01-1m2", status: "actif", monthlyRent: 59,
    startDate: "2023-11-12T09:00:00Z", contractUrl: "/documents/contrat-012.pdf",
  },
  {
    id: "ctr-013", clientId: "c11", centerId: "ctr-lyon-02", boxId: "box-lyo02-C08",
    boxTypeId: "bx-lyon-02-6m2", status: "actif", monthlyRent: 182,
    startDate: "2024-03-02T09:00:00Z", contractUrl: "/documents/contrat-013.pdf",
  },
  {
    id: "ctr-014", clientId: "c12", centerId: "ctr-bordeaux-04", boxId: "box-bdx04-B07",
    boxTypeId: "bx-bordeaux-04-4m2", status: "actif", monthlyRent: 126,
    promoCode: "PARRAIN15", promoEndDate: "2024-06-01",
    startDate: "2023-12-15T09:00:00Z", contractUrl: "/documents/contrat-014.pdf",
  },
];

// Generate ~50 more contracts for generated clients
const contracts: Contract[] = [...handCraftedContracts];
for (let i = 15; i <= 65; i++) {
  const clientId = `c${((i - 1) % 40) + 13}`;
  const centerIdx = i % centers.length;
  const center = centers[centerIdx];
  const centerBoxTypes = boxTypes.filter((b) => b.centerId === center.id);
  const bt = centerBoxTypes[i % centerBoxTypes.length] || boxTypes[0];
  const status = contractStatuses[i % contractStatuses.length];
  const promo = promoCodes[i % promoCodes.length];
  contracts.push({
    id: `ctr-${String(i).padStart(3, "0")}`,
    clientId,
    centerId: center.id,
    boxId: `box-gen-${i}`,
    boxTypeId: bt.id,
    status,
    monthlyRent: bt.basePrice + 10 + (i % 20),
    promoCode: promo ?? undefined,
    promoEndDate: promo ? `2025-${String(1 + (i % 12)).padStart(2, "0")}-15` : undefined,
    priceIncreaseAmount: i % 5 === 0 ? 5 + (i % 10) : undefined,
    priceIncreaseDate: i % 5 === 0 ? `2025-${String(1 + (i % 11)).padStart(2, "0")}-01` : undefined,
    startDate: new Date(Date.UTC(2023, 8 + (i % 6), 1 + (i % 28), 9, 0, 0)).toISOString(),
    endDate: status === "terminé" ? new Date(Date.UTC(2024, (i % 6), 1 + (i % 28), 9, 0, 0)).toISOString() : undefined,
    contractUrl: `/documents/contrat-${String(i).padStart(3, "0")}.pdf`,
  });
}

// ────────────────────────────────────────────────────────────
// INVOICES / TRANSACTIONS
// ────────────────────────────────────────────────────────────

const invoices: Invoice[] = [];
const invoiceStatuses: InvoiceStatus[] = ["payé", "payé", "payé", "impayé", "en retard"];

// Generate invoices for each contract — monthly rent over ~6 months
contracts.forEach((contract) => {
  const startMonth = new Date(contract.startDate).getMonth();
  const startYear = new Date(contract.startDate).getFullYear();
  const months = contract.status === "terminé" ? 4 : 6;

  for (let m = 0; m < months; m++) {
    const month = (startMonth + m) % 12;
    const year = startYear + Math.floor((startMonth + m) / 12);
    const dueDate = new Date(Date.UTC(year, month, 5)).toISOString();
    const isUnpaid = contract.status === "impayé" && m >= months - 2;
    const isLate = contract.status === "squatteur" && m >= months - 3;
    const status: InvoiceStatus = isUnpaid ? "impayé" : isLate ? "en retard" : invoiceStatuses[m % invoiceStatuses.length];
    const paidDate = status === "payé"
      ? new Date(Date.UTC(year, month, 3 + (m % 5))).toISOString()
      : undefined;

    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

    invoices.push({
      id: `inv-${contract.id}-${m}`,
      clientId: contract.clientId,
      contractId: contract.id,
      type: "loyer",
      amount: contract.monthlyRent,
      dueDate,
      paidDate,
      status,
      label: `Loyer ${monthNames[month]} ${year} — ${contract.boxId}`,
    });
  }

  // Add a one-time "frais" for some
  if (contract.id.endsWith("1") || contract.id.endsWith("5")) {
    invoices.push({
      id: `inv-${contract.id}-frais`,
      clientId: contract.clientId,
      contractId: contract.id,
      type: "frais",
      amount: 25,
      dueDate: contract.startDate,
      paidDate: contract.startDate,
      status: "payé",
      label: `Frais de dossier — ${contract.boxId}`,
    });
  }
});

// ────────────────────────────────────────────────────────────
// INDIVIDUAL BOXES (with codes, floors, etc.)
// ────────────────────────────────────────────────────────────

const boxStatuses: IndividualBoxStatus[] = ["libre", "occupé", "occupé", "occupé", "réservé", "maintenance"];
const individualBoxes: IndividualBox[] = [];

const centerConfig: Record<string, { prefix: string; floors: number; sizesPerFloor: { sizeM2: number; heightM: number; count: number; btId: string }[] }> = {
  "ctr-paris-01": {
    prefix: "PAR",
    floors: 3,
    sizesPerFloor: [
      { sizeM2: 1, heightM: 2.2, count: 8, btId: "bx-paris-01-1m2" },
      { sizeM2: 3, heightM: 2.6, count: 6, btId: "bx-paris-01-3m2" },
      { sizeM2: 5, heightM: 2.7, count: 4, btId: "bx-paris-01-3m2" },
      { sizeM2: 7, heightM: 3.0, count: 2, btId: "bx-paris-01-3m2" },
    ],
  },
  "ctr-lyon-02": {
    prefix: "LYO",
    floors: 2,
    sizesPerFloor: [
      { sizeM2: 1, heightM: 2.1, count: 6, btId: "bx-lyon-02-3m2" },
      { sizeM2: 3, heightM: 2.5, count: 8, btId: "bx-lyon-02-3m2" },
      { sizeM2: 6, heightM: 2.8, count: 5, btId: "bx-lyon-02-6m2" },
    ],
  },
  "ctr-marseille-03": {
    prefix: "MRS",
    floors: 2,
    sizesPerFloor: [
      { sizeM2: 2, heightM: 2.3, count: 10, btId: "bx-marseille-03-2m2" },
      { sizeM2: 5, heightM: 2.7, count: 6, btId: "bx-marseille-03-5m2" },
      { sizeM2: 7, heightM: 3.0, count: 3, btId: "bx-marseille-03-5m2" },
    ],
  },
  "ctr-bordeaux-04": {
    prefix: "BDX",
    floors: 2,
    sizesPerFloor: [
      { sizeM2: 1, heightM: 2.0, count: 10, btId: "bx-bordeaux-04-1m2" },
      { sizeM2: 4, heightM: 2.5, count: 7, btId: "bx-bordeaux-04-4m2" },
      { sizeM2: 6, heightM: 2.8, count: 3, btId: "bx-bordeaux-04-4m2" },
    ],
  },
  "ctr-lille-05": {
    prefix: "LIL",
    floors: 3,
    sizesPerFloor: [
      { sizeM2: 2, heightM: 2.4, count: 8, btId: "bx-lille-05-2m2" },
      { sizeM2: 5, heightM: 2.7, count: 5, btId: "bx-lille-05-2m2" },
      { sizeM2: 7, heightM: 3.0, count: 4, btId: "bx-lille-05-7m2" },
    ],
  },
  "ctr-toulouse-06": {
    prefix: "TLS",
    floors: 2,
    sizesPerFloor: [
      { sizeM2: 1, heightM: 2.2, count: 6, btId: "bx-toulouse-06-3m2" },
      { sizeM2: 3, heightM: 2.5, count: 8, btId: "bx-toulouse-06-3m2" },
      { sizeM2: 6, heightM: 2.8, count: 4, btId: "bx-toulouse-06-6m2" },
    ],
  },
};

let boxCounter = 0;
Object.entries(centerConfig).forEach(([centerId, cfg]) => {
  for (let floor = 0; floor < cfg.floors; floor++) {
    const floorLetter = String.fromCharCode(65 + floor); // A=RDC, B=1er, C=2ème
    cfg.sizesPerFloor.forEach((sizeConf) => {
      for (let i = 1; i <= sizeConf.count; i++) {
        boxCounter++;
        const code = `${floorLetter}${String(i).padStart(2, "0")}`;
        const status = boxStatuses[boxCounter % boxStatuses.length];
        // Link some occupied boxes to known contracts
        const linkedContract = contracts.find(
          (c) => c.centerId === centerId && c.boxId === `box-${cfg.prefix.toLowerCase()}${centerId.slice(-2)}-${code}`
        );
        individualBoxes.push({
          id: `box-${cfg.prefix.toLowerCase()}-${floor}-${sizeConf.sizeM2}-${i}`,
          boxTypeId: sizeConf.btId,
          centerId,
          floor,
          code: `${cfg.prefix}-${code}`,
          status: linkedContract ? "occupé" : status,
          clientId: linkedContract?.clientId,
          contractId: linkedContract?.id,
          comment: boxCounter % 7 === 0 ? "Signalement: légère humidité constatée lors dernière visite." : undefined,
          heightM: sizeConf.heightM,
          sizeM2: sizeConf.sizeM2,
        });
      }
    });
  }
});

// ────────────────────────────────────────────────────────────
// QUOTE REQUESTS
// ────────────────────────────────────────────────────────────

const quoteStatuses: QuoteRequest["status"][] = ["new", "sent", "accepted", "expired", "abandoned"];
const quoteRequests: QuoteRequest[] = [];

const quoteNames = [
  "Marine Lefèvre", "Hugo Blanc", "SCI Rivoli", "TransExpress SARL", "Agathe Renaud",
  "DataBox SAS", "Paul Mercier", "Atelier du Bois", "Claire Fontaine", "MedStock",
  "Antoine Leroy", "Sophie Bernard", "Garage du Port", "FastMove", "Émilie Petit",
  "ProStore", "Lucas Moreau", "Cartons & Co", "Julie Dubois", "NordLog",
  "Maxime Roux", "Réseau Plus", "Anna Schmidt", "BioCoop Stock", "Kevin Durand",
  "FlexiBox SARL", "Laura Martin", "EcoStock", "Vincent Giraud", "StockPremium",
];

for (let i = 0; i < 30; i++) {
  const center = centers[i % centers.length];
  quoteRequests.push({
    id: `quote-${String(i + 1).padStart(3, "0")}`,
    clientId: i < 12 ? `c${i + 1}` : undefined,
    fullName: quoteNames[i],
    email: `${quoteNames[i].toLowerCase().replace(/[^a-z]/g, ".")}@example.com`,
    phone: i % 3 === 0 ? `+33 6 ${String(10 + i).padStart(2, "0")} ${String(20 + i).padStart(2, "0")} ${String(30 + i).padStart(2, "0")} ${String(40 + i).padStart(2, "0")}` : undefined,
    centerId: center.id,
    boxSizeWanted: [1, 2, 3, 4, 5, 6, 7][i % 7],
    status: quoteStatuses[i % quoteStatuses.length],
    createdAt: new Date(Date.UTC(2024, i % 3, 1 + (i % 28), 8 + (i % 10), 15, 0)).toISOString(),
    sentAt: quoteStatuses[i % quoteStatuses.length] !== "new"
      ? new Date(Date.UTC(2024, i % 3, 2 + (i % 28), 10, 0, 0)).toISOString()
      : undefined,
    message: i % 2 === 0
      ? `Je cherche un espace de ${[1, 2, 3, 4, 5, 6, 7][i % 7]}m² pour du stockage ${i % 3 === 0 ? "professionnel" : "personnel"}. Merci de me faire parvenir un devis.`
      : undefined,
  });
}

// ────────────────────────────────────────────────────────────
// UNFINISHED BOOKINGS
// ────────────────────────────────────────────────────────────

const leadSources: LeadSource[] = ["bot-ia", "landing-page", "leboncoin", "site-front", "facebook", "google-ads", "parrainage"];
const unfinishedBookings: UnfinishedBooking[] = [];

const ubNames = [
  "Marc Duval", "Céline Faure", null, "Tristan Morel", null,
  "Inès Barbier", "LogiPro SAS", null, "Raphaël Simon", "Amandine Gil",
  null, "Stéphane Brun", "NordStock", "Eva Martinez", null,
  "Benjamin Roy", null, "Caroline Perrin", "FlexLog", "Omar Diallo",
  null, "Justine Lambert", "ProBox", "Adrien Chevalier", "Nadia El Amrani",
];

for (let i = 0; i < 25; i++) {
  const center = centers[i % centers.length];
  const centerBt = boxTypes.filter((b) => b.centerId === center.id);
  const bt = centerBt[i % centerBt.length] || boxTypes[0];
  const totalSteps = 5;
  const step = 1 + (i % totalSteps);
  unfinishedBookings.push({
    id: `ub-${String(i + 1).padStart(3, "0")}`,
    email: i % 4 !== 2 ? `prospect${i + 1}@example.com` : undefined,
    phone: i % 3 === 0 ? `+33 6 ${String(50 + i).padStart(2, "0")} 11 22 33` : undefined,
    fullName: ubNames[i] ?? undefined,
    centerId: center.id,
    boxTypeId: bt.id,
    step,
    totalSteps,
    stoppedAt: new Date(Date.UTC(2024, 1 + (i % 2), 1 + (i % 27), 10 + (i % 8), 30, 0)).toISOString(),
    price: bt.basePrice + (i % 15),
    source: leadSources[i % leadSources.length],
  });
}

// ────────────────────────────────────────────────────────────
// CONVERSATIONS (Email & SMS)
// ────────────────────────────────────────────────────────────

const conversations: Conversation[] = [];

function makeMessages(count: number, startDate: string): ConversationMessage[] {
  const msgs: ConversationMessage[] = [];
  const base = new Date(startDate).getTime();
  for (let i = 0; i < count; i++) {
    msgs.push({
      id: `msg-${base}-${i}`,
      direction: i % 2 === 0 ? "outbound" : "inbound",
      content: i % 2 === 0
        ? ["Bonjour, nous vous contactons au sujet de votre espace de stockage.", "Avez-vous pu prendre connaissance de notre offre ?", "N'hésitez pas à nous contacter pour toute question.", "Nous restons à votre disposition.", "Rappel: votre facture est en attente de paiement."][i % 5]
        : ["Merci pour votre message, je regarde ça.", "Oui c'est noté, je reviens vers vous.", "Est-ce qu'il y a une réduction possible ?", "Je souhaiterais modifier ma réservation.", "D'accord, je m'en occupe cette semaine."][i % 5],
      timestamp: new Date(base + i * 3600000 * (2 + (i % 4))).toISOString(),
      read: i < count - 1,
    });
  }
  return msgs;
}

// Create conversations for first 12 clients
const convSubjects = [
  "Bienvenue chez Costockage", "Suivi de votre contrat", "Relance facture impayée",
  "Demande de changement de box", "Renouvellement contrat", "Accès weekend",
  "Question facturation", "Promo spéciale", "Mise en demeure", "Satisfaction client",
];
for (let c = 1; c <= 12; c++) {
  const emailConvCount = c <= 6 ? 2 : 1;
  const smsConvCount = c <= 4 ? 1 : 0;

  for (let e = 0; e < emailConvCount; e++) {
    conversations.push({
      id: `conv-email-c${c}-${e}`,
      clientId: `c${c}`,
      type: "email",
      subject: convSubjects[(c + e) % convSubjects.length],
      messages: makeMessages(3 + (c % 4), `2024-0${1 + (c % 2)}-${String(1 + (c % 25)).padStart(2, "0")}T09:00:00Z`),
      createdAt: `2024-0${1 + (c % 2)}-${String(1 + (c % 25)).padStart(2, "0")}T09:00:00Z`,
    });
  }

  for (let s = 0; s < smsConvCount; s++) {
    conversations.push({
      id: `conv-sms-c${c}-${s}`,
      clientId: `c${c}`,
      type: "sms",
      subject: `SMS — ${convSubjects[(c + 3) % convSubjects.length]}`,
      messages: makeMessages(2 + (c % 3), `2024-0${1 + (c % 2)}-${String(5 + (c % 20)).padStart(2, "0")}T14:00:00Z`),
      createdAt: `2024-0${1 + (c % 2)}-${String(5 + (c % 20)).padStart(2, "0")}T14:00:00Z`,
    });
  }
}

// Generate for bulk clients
for (let c = 13; c <= 30; c++) {
  conversations.push({
    id: `conv-email-c${c}-0`,
    clientId: `c${c}`,
    type: "email",
    subject: convSubjects[c % convSubjects.length],
    messages: makeMessages(2 + (c % 3), `2024-0${1 + (c % 2)}-${String(1 + (c % 25)).padStart(2, "0")}T10:00:00Z`),
    createdAt: `2024-0${1 + (c % 2)}-${String(1 + (c % 25)).padStart(2, "0")}T10:00:00Z`,
  });
}

// ────────────────────────────────────────────────────────────
// CLIENT HISTORY EVENTS
// ────────────────────────────────────────────────────────────

const historyTypes: ClientHistoryType[] = ["call", "email", "note", "contract", "payment", "action"];
const historyEvents: ClientHistoryEvent[] = [];

const historySummaries: Record<ClientHistoryType, string[]> = {
  call: ["Appel entrant — question sur la facture", "Appel sortant — relance impayé", "Appel entrant — demande de renseignement", "Appel sortant — confirmation réservation", "Appel entrant — réclamation accès"],
  email: ["Email envoyé — devis joint", "Email reçu — demande de résiliation", "Email envoyé — rappel CGV", "Email reçu — confirmation de paiement", "Email envoyé — bienvenue"],
  note: ["Note interne — client à surveiller", "Note interne — prospect chaud", "Note interne — feedback positif", "Note interne — rappeler la semaine prochaine", "Note interne — vérifier accès badge"],
  contract: ["Nouveau contrat signé", "Contrat résilié", "Contrat renouvelé", "Avenant ajouté au contrat", "Contrat passé en impayé"],
  payment: ["Paiement reçu par CB", "Paiement reçu par virement", "Échec de prélèvement", "Remboursement effectué", "Avoir généré"],
  action: ["Mise en demeure envoyée", "Badge d'accès désactivé", "Transfert de box effectué", "Code promo appliqué", "Déclaration squatteur"],
};

// Generate rich history for first 12 clients
for (let c = 1; c <= 12; c++) {
  const eventCount = 8 + (c % 6);
  for (let e = 0; e < eventCount; e++) {
    const type = historyTypes[e % historyTypes.length];
    const summaries = historySummaries[type];
    historyEvents.push({
      id: `hist-c${c}-${e}`,
      clientId: `c${c}`,
      type,
      summary: summaries[e % summaries.length],
      timestamp: new Date(Date.UTC(2024, e % 3, 1 + (e * 2 + c) % 28, 8 + (e % 10), e * 7 % 60, 0)).toISOString(),
      pinned: e === 0 || (c <= 4 && e === 3),
      details: e % 3 === 0 ? `Détail supplémentaire pour l'événement #${e} du client c${c}.` : undefined,
    });
  }
}

// Generate for bulk clients
for (let c = 13; c <= 52; c++) {
  const eventCount = 3 + (c % 4);
  for (let e = 0; e < eventCount; e++) {
    const type = historyTypes[e % historyTypes.length];
    const summaries = historySummaries[type];
    historyEvents.push({
      id: `hist-c${c}-${e}`,
      clientId: `c${c}`,
      type,
      summary: summaries[(e + c) % summaries.length],
      timestamp: new Date(Date.UTC(2024, (c + e) % 3, 1 + ((e * 3 + c) % 28), 9, 0, 0)).toISOString(),
      pinned: false,
    });
  }
}

// ────────────────────────────────────────────────────────────
// PRICING TIERS (matrix: center × size × floor → 4 price tiers)
// ────────────────────────────────────────────────────────────

const pricingTiers: PricingTier[] = [];
const trends: Trend[] = ["up", "down", "stable", "up", "stable"];

Object.entries(centerConfig).forEach(([centerId, cfg]) => {
  for (let floor = 0; floor < cfg.floors; floor++) {
    cfg.sizesPerFloor.forEach((sizeConf, sIdx) => {
      const directorPrice = sizeConf.sizeM2 * 25 + (floor === 0 ? 10 : floor === 1 ? 5 : 0);
      const available = sizeConf.count - Math.floor(sizeConf.count * (0.3 + (sIdx * 0.15)));
      const total = sizeConf.count;
      const trendIdx = (floor + sIdx + centerId.length) % trends.length;

      const pctAbove20 = -5;
      const pctAbove10 = 0;
      const pctBelow10 = 10;
      const pctBelow5 = 20;

      // Days since last change for coloring
      const daysAgo = 5 + ((sIdx + floor) * 12) % 90;
      const lastChange = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const columnDaysAgo = 3 + ((sIdx + floor) * 7) % 60;
      const lastColumnChange = new Date(Date.now() - columnDaysAgo * 86400000).toISOString();

      pricingTiers.push({
        id: `pt-${centerId}-${sizeConf.sizeM2}m2-f${floor}`,
        centerId,
        boxSizeM2: sizeConf.sizeM2,
        floor,
        basePrice: directorPrice,
        percentAbove20: pctAbove20,
        percentAbove10: pctAbove10,
        percentBelow10: pctBelow10,
        percentBelow5: pctBelow5,
        priceAbove20: Math.round(directorPrice * (1 + pctAbove20 / 100)),
        priceAbove10: Math.round(directorPrice * (1 + pctAbove10 / 100)),
        priceBelow10: Math.round(directorPrice * (1 + pctBelow10 / 100)),
        priceBelow5: Math.round(directorPrice * (1 + pctBelow5 / 100)),
        currentAvailable: Math.max(0, available),
        totalUnits: total,
        trend: trends[trendIdx],
        lastPriceChangeDate: lastChange,
        lastColumnChangeDate: lastColumnChange,
      });
    });
  }
});

// ────────────────────────────────────────────────────────────
// EXPORTED FUNCTIONS
// ────────────────────────────────────────────────────────────

export function getContracts(): Contract[] {
  return contracts;
}

export function getContractsByClient(clientId: string): Contract[] {
  return contracts.filter((c) => c.clientId === clientId);
}

export function getInvoices(): Invoice[] {
  return invoices;
}

export function getInvoicesByClient(clientId: string): Invoice[] {
  return invoices.filter((inv) => inv.clientId === clientId);
}

export function getInvoicesByContract(contractId: string): Invoice[] {
  return invoices.filter((inv) => inv.contractId === contractId);
}

export function getUnpaidInvoicesByClient(clientId: string): Invoice[] {
  return invoices.filter((inv) => inv.clientId === clientId && (inv.status === "impayé" || inv.status === "en retard"));
}

export function getIndividualBoxes(): IndividualBox[] {
  return individualBoxes;
}

export function getIndividualBoxesByCenter(centerId: string): IndividualBox[] {
  return individualBoxes.filter((b) => b.centerId === centerId);
}

export function getIndividualBoxesByClient(clientId: string): IndividualBox[] {
  return individualBoxes.filter((b) => b.clientId === clientId);
}

export function getQuoteRequests(): QuoteRequest[] {
  return quoteRequests;
}

export function getQuoteRequestsByClient(clientId: string): QuoteRequest[] {
  return quoteRequests.filter((q) => q.clientId === clientId);
}

export function getUnfinishedBookings(): UnfinishedBooking[] {
  return unfinishedBookings;
}

export function getConversationsByClient(clientId: string): Conversation[] {
  return conversations.filter((c) => c.clientId === clientId);
}

export function addConversation(clientId: string, type: "email" | "sms", subject: string): Conversation {
  const conv: Conversation = {
    id: `conv-${type}-${clientId}-${Date.now()}`,
    clientId,
    type,
    subject,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  conversations.push(conv);
  return conv;
}

export function addMessageToConversation(conversationId: string, direction: "inbound" | "outbound", content: string): ConversationMessage | null {
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) return null;
  const msg: ConversationMessage = {
    id: `msg-${Date.now()}-${conv.messages.length}`,
    direction,
    content,
    timestamp: new Date().toISOString(),
    read: false,
  };
  conv.messages.push(msg);
  return msg;
}

export function getHistoryByClient(clientId: string): ClientHistoryEvent[] {
  return historyEvents
    .filter((h) => h.clientId === clientId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function toggleHistoryPin(eventId: string): boolean {
  const event = historyEvents.find((h) => h.id === eventId);
  if (!event) return false;
  event.pinned = !event.pinned;
  return event.pinned;
}

export function getPricingTiers(): PricingTier[] {
  return pricingTiers;
}

export function getPricingTiersByCenter(centerId: string): PricingTier[] {
  return pricingTiers.filter((t) => t.centerId === centerId);
}

export function updatePricingTier(
  tierId: string,
  updates: Partial<Pick<PricingTier, "basePrice" | "percentAbove20" | "percentAbove10" | "percentBelow10" | "percentBelow5" | "priceAbove20" | "priceAbove10" | "priceBelow10" | "priceBelow5">>
): PricingTier | null {
  const tier = pricingTiers.find((t) => t.id === tierId);
  if (!tier) return null;

  // Determine the effective base price to use when back-computing percentages
  const effectiveBasePrice =
    typeof updates.basePrice === "number" ? updates.basePrice : tier.basePrice;

  // Back-compute percentage values from any updated price* fields
  const derivedPercentUpdates: Partial<Record<PercentColumn, number>> = {};
  if (typeof effectiveBasePrice === "number" && effectiveBasePrice !== 0) {
    (Object.keys(percentToPrice) as PercentColumn[]).forEach((percentKey) => {
      const priceKey = percentToPrice[percentKey];
      const updatedPrice = updates[priceKey];
      if (typeof updatedPrice === "number") {
        derivedPercentUpdates[percentKey] =
          ((updatedPrice / effectiveBasePrice) - 1) * 100;
      }
    });
  }

  // Merge original updates with any derived percentage updates
  const combinedUpdates: typeof updates & Partial<Record<PercentColumn, number>> = {
    ...updates,
    ...derivedPercentUpdates,
  };

  // Decide whether prices need to be recomputed from basePrice/percentages
  let shouldRecompute = false;
  if (typeof combinedUpdates.basePrice === "number") {
    shouldRecompute = true;
  } else {
    const percentColumns: PercentColumn[] = [
      "percentAbove20",
      "percentAbove10",
      "percentBelow10",
      "percentBelow5",
    ];
    shouldRecompute = percentColumns.some(
      (percentKey) => typeof combinedUpdates[percentKey] === "number"
    );
  }

  Object.assign(tier, combinedUpdates);

  if (shouldRecompute) {
    // Recompute prices from basePrice + percentages
    recomputePrices(tier);
  }
  tier.lastPriceChangeDate = new Date().toISOString();
  return tier;
}

type PercentColumn = "percentAbove20" | "percentAbove10" | "percentBelow10" | "percentBelow5";
type PriceColumn = "priceAbove20" | "priceAbove10" | "priceBelow10" | "priceBelow5";

const percentToPrice: Record<PercentColumn, PriceColumn> = {
  percentAbove20: "priceAbove20",
  percentAbove10: "priceAbove10",
  percentBelow10: "priceBelow10",
  percentBelow5: "priceBelow5",
};

function recomputePrices(tier: PricingTier): void {
  tier.priceAbove20 = Math.round(tier.basePrice * (1 + tier.percentAbove20 / 100));
  tier.priceAbove10 = Math.round(tier.basePrice * (1 + tier.percentAbove10 / 100));
  tier.priceBelow10 = Math.round(tier.basePrice * (1 + tier.percentBelow10 / 100));
  tier.priceBelow5 = Math.round(tier.basePrice * (1 + tier.percentBelow5 / 100));
}

export function bulkUpdatePricingTiers(
  tierIds: string[],
  action: { type: "percent"; deltaPercent: number } | { type: "absolute"; deltaAmount: number },
  targetColumns?: PercentColumn[],
  options?: { roundToEuro?: boolean; modifyPriceDirectly?: boolean }
): PricingTier[] {
  const updated: PricingTier[] = [];
  tierIds.forEach((id) => {
    const tier = pricingTiers.find((t) => t.id === id);
    if (!tier) return;

    const fields: PercentColumn[] = targetColumns && targetColumns.length > 0
      ? targetColumns
      : (["percentAbove20", "percentAbove10", "percentBelow10", "percentBelow5"] as const);

    if (options?.modifyPriceDirectly) {
      // Direct price modification mode
      for (const pctField of fields) {
        const priceField = percentToPrice[pctField];
        if (action.type === "percent") {
          tier[priceField] = Math.round(tier[priceField] * (1 + action.deltaPercent / 100));
        } else {
          tier[priceField] = Math.max(0, tier[priceField] + action.deltaAmount);
        }
        // Back-compute percentage from price
        if (tier.basePrice > 0) {
          tier[pctField] = parseFloat(((tier[priceField] / tier.basePrice - 1) * 100).toFixed(2));
        } else {
          // When basePrice is not positive, keep the invariant by zeroing both price and percent
          tier[priceField] = 0;
          tier[pctField] = 0;
        }
      }
    } else {
      // Percentage modification mode (default)
      for (const pctField of fields) {
        if (action.type === "percent") {
          tier[pctField] = parseFloat((tier[pctField] + action.deltaPercent).toFixed(2));
        } else {
          // Absolute: convert euro delta to percentage shift relative to basePrice
          if (tier.basePrice > 0) {
            const pctShift = (action.deltaAmount / tier.basePrice) * 100;
            tier[pctField] = parseFloat((tier[pctField] + pctShift).toFixed(2));
          }
        }
      }
      recomputePrices(tier);
    }

    if (options?.roundToEuro) {
      for (const pctField of fields) {
        const priceField = percentToPrice[pctField];
        tier[priceField] = Math.ceil(tier[priceField]);
        if (tier.basePrice > 0) {
          tier[pctField] = parseFloat(((tier[priceField] / tier.basePrice - 1) * 100).toFixed(2));
        }
      }
    }

    tier.lastPriceChangeDate = new Date().toISOString();
    updated.push(tier);
  });
  return updated;
}

export function bulkUpdateBasePrice(
  tierIds: string[],
  action: { type: "percent"; deltaPercent: number } | { type: "absolute"; deltaAmount: number }
): PricingTier[] {
  const updated: PricingTier[] = [];
  tierIds.forEach((id) => {
    const tier = pricingTiers.find((t) => t.id === id);
    if (!tier) return;
    if (action.type === "percent") {
      tier.basePrice = Math.round(tier.basePrice * (1 + action.deltaPercent / 100));
    } else {
      tier.basePrice = Math.max(0, Math.round(tier.basePrice + action.deltaAmount));
    }
    recomputePrices(tier);
    tier.lastPriceChangeDate = new Date().toISOString();
    updated.push(tier);
  });
  return updated;
}

export function getActivePriceField(tier: PricingTier): "priceAbove20" | "priceAbove10" | "priceBelow10" | "priceBelow5" {
  if (tier.currentAvailable > 20) return "priceAbove20";
  if (tier.currentAvailable > 10) return "priceAbove10";
  if (tier.currentAvailable > 5) return "priceBelow10";
  return "priceBelow5";
}

export function getActivePrice(tier: PricingTier): number {
  return tier[getActivePriceField(tier)];
}
