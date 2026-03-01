import type {
  Client,
  Booking,
  BookingFollowUpTicket,
  BookingStatus,
  ClientBox,
  Communication,
} from "@/lib/types";
import { getBookings } from "./bookings-and-dashboard";
import { boxTypes } from "./centers-and-pricing";

const clients: Client[] = [
  {
    id: "c1",
    fullName: "Alice Martin",
    firstName: "Alice",
    lastName: "Martin",
    email: "alice.martin@example.com",
    phone: "+33 6 12 34 56 78",
    createdAt: "2024-01-10T09:15:00Z",
    segment: "B2C",
    status: "active",
    preferredCenterId: "ctr-paris-01",
    notes: "Sensible au prix, préfère les centres intra-muros.",
    walletAmount: 45,
    unpaidAmount: 0,
    address: "15 rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    birthDate: "1992-04-18",
    longComment: "Cliente fidèle depuis janvier 2024. Très réactive par email. A déjà recommandé 2 personnes. Préfère être contactée en fin de journée après 17h. Envisage un upgrade de box si promo disponible au printemps.",
    leadSource: "site-front",
    viewedBoxSizes: [1, 2, 3],
  },
  {
    id: "c2",
    fullName: "Société Dupont Logistique",
    firstName: "Jean",
    lastName: "Dupont",
    email: "contact@dupont-logistique.fr",
    phone: "+33 1 45 67 89 01",
    createdAt: "2023-11-02T14:30:00Z",
    segment: "B2B",
    status: "active",
    preferredCenterId: "ctr-lyon-02",
    notes: "Client marketplace avec volumes importants.",
    walletAmount: 210,
    unpaidAmount: 64,
    address: "Zone Industrielle Nord, Bâtiment C",
    city: "Lyon",
    postalCode: "69007",
    longComment: "Société de logistique avec besoin croissant. Actuellement 2 boxes, souhaite regrouper facturation. Attention: retard de paiement récurrent sur petits montants. Contact principal: Jean Dupont, DG.",
    leadSource: "google-ads",
    viewedBoxSizes: [3, 6, 7],
  },
  {
    id: "c3",
    fullName: "Nora Benali",
    firstName: "Nora",
    lastName: "Benali",
    email: "nora.benali@example.com",
    phone: "+33 6 43 21 98 77",
    createdAt: "2024-01-22T12:00:00Z",
    segment: "B2C",
    status: "lead",
    preferredCenterId: "ctr-marseille-03",
    notes: "Hésite entre 2m² et 5m² selon saison.",
    walletAmount: 0,
    unpaidAmount: 88,
    address: "42 avenue du Prado",
    city: "Marseille",
    postalCode: "13006",
    birthDate: "1988-11-25",
    longComment: "Lead chaud. A visité le centre de Marseille le 20/01. Hésite sur la taille. Rappeler fin février pour finaliser. Budget serré mais flexible sur la durée d'engagement.",
    leadSource: "facebook",
    viewedBoxSizes: [2, 3, 5],
  },
  {
    id: "c4",
    fullName: "Atelier Roche SARL",
    firstName: "Philippe",
    lastName: "Roche",
    email: "contact@atelier-roche.fr",
    phone: "+33 5 56 44 10 10",
    createdAt: "2023-12-14T08:35:00Z",
    segment: "B2B",
    status: "active",
    preferredCenterId: "ctr-bordeaux-04",
    notes: "Stockage archives et matériel salon.",
    walletAmount: 110,
    unpaidAmount: 0,
    address: "8 rue des Artisans",
    city: "Bordeaux",
    postalCode: "33000",
    longComment: "Client B2B stable, bon payeur. Utilise principalement pour stocker du matériel de salon professionnel. Accès fréquent en semaine. A signé un engagement 12 mois.",
    leadSource: "parrainage",
    viewedBoxSizes: [4, 5],
  },
  {
    id: "c5",
    fullName: "Julien Petit",
    firstName: "Julien",
    lastName: "Petit",
    email: "julien.petit@example.com",
    phone: "+33 6 77 22 14 99",
    createdAt: "2023-10-03T18:10:00Z",
    segment: "B2C",
    status: "churned",
    preferredCenterId: "ctr-paris-01",
    notes: "Résiliation suite déménagement.",
    walletAmount: 0,
    unpaidAmount: 34,
    address: "3 rue Victor Hugo",
    city: "Paris",
    postalCode: "75016",
    birthDate: "1985-07-02",
    longComment: "Client résilié en décembre 2023 suite à un déménagement en province. Restait un impayé de 34€ sur le dernier mois. Tentative de recouvrement par email en janvier, sans réponse.",
    leadSource: "site-front",
    viewedBoxSizes: [1, 3],
  },
  {
    id: "c6",
    fullName: "E-com Nord Distribution",
    firstName: "Thomas",
    lastName: "Lefebvre",
    email: "ops@ecom-nord.fr",
    phone: "+33 3 20 11 22 33",
    createdAt: "2024-01-05T07:50:00Z",
    segment: "B2B",
    status: "active",
    preferredCenterId: "ctr-lille-05",
    notes: "Besoin de 2 à 3 boxes évolutif.",
    walletAmount: 320,
    unpaidAmount: 140,
    address: "Parc d'activités Grand Sud, Bât. 7",
    city: "Lille",
    postalCode: "59000",
    longComment: "E-commerçant en forte croissance. Actuellement 2 boxes (2m² + 7m²). Problème récurrent d'impayés liés à leur process de validation comptable interne (30j fin de mois). Contact: Thomas Lefebvre, Responsable logistique.",
    leadSource: "google-ads",
    viewedBoxSizes: [2, 5, 7],
  },
  {
    id: "c7",
    fullName: "Camille Moreau",
    firstName: "Camille",
    lastName: "Moreau",
    email: "camille.moreau@example.com",
    phone: "+33 6 15 99 88 77",
    createdAt: "2024-02-02T10:25:00Z",
    segment: "B2C",
    status: "active",
    preferredCenterId: "ctr-toulouse-06",
    notes: "Recherche accès weekend.",
    walletAmount: 25,
    unpaidAmount: 0,
    address: "22 rue Alsace-Lorraine",
    city: "Toulouse",
    postalCode: "31000",
    birthDate: "1995-03-12",
    longComment: "Utilise sa box principalement le weekend pour du matériel sportif. Très satisfaite du service. Potentiel de parrainage élevé.",
    leadSource: "landing-page",
    viewedBoxSizes: [3],
  },
  {
    id: "c8",
    fullName: "Garage Saint-Michel",
    firstName: "Michel",
    lastName: "Garcia",
    email: "contact@garage-sm.fr",
    phone: "+33 4 91 01 02 03",
    createdAt: "2023-09-20T15:40:00Z",
    segment: "B2B",
    status: "active",
    preferredCenterId: "ctr-marseille-03",
    notes: "Entreposage pneus saisonniers.",
    walletAmount: 90,
    unpaidAmount: 20,
    address: "Boulevard Saint-Michel, Zone Artisanale",
    city: "Marseille",
    postalCode: "13005",
    longComment: "Garage automobile, stocke les pneus été/hiver de ses clients. Pic d'accès en octobre et mars. Petit impayé en cours mais historiquement bon payeur.",
    leadSource: "leboncoin",
    viewedBoxSizes: [5, 6],
  },
  {
    id: "c9",
    fullName: "Léa Girard",
    firstName: "Léa",
    lastName: "Girard",
    email: "lea.girard@example.com",
    phone: "+33 6 70 45 12 89",
    createdAt: "2024-01-29T13:15:00Z",
    segment: "B2C",
    status: "lead",
    preferredCenterId: "ctr-bordeaux-04",
    notes: "Souhaite un essai 1 mois.",
    walletAmount: 0,
    unpaidAmount: 52,
    address: "5 place de la Bourse",
    city: "Bordeaux",
    postalCode: "33000",
    birthDate: "1997-09-30",
    longComment: "Lead en cours. A demandé un devis pour 1m² à Bordeaux. Souhaite essayer 1 mois avant de s'engager. Rappeler début mars.",
    leadSource: "bot-ia",
    viewedBoxSizes: [1, 2],
  },
  {
    id: "c10",
    fullName: "TechNova SAS",
    firstName: "Alexandre",
    lastName: "Nguyen",
    email: "admin@technova.fr",
    phone: "+33 1 89 00 12 34",
    createdAt: "2023-11-25T09:05:00Z",
    segment: "B2B",
    status: "active",
    preferredCenterId: "ctr-paris-01",
    notes: "Matériel salon & PLV.",
    walletAmount: 75,
    unpaidAmount: 0,
    address: "Tour Montparnasse, 33 avenue du Maine",
    city: "Paris",
    postalCode: "75015",
    longComment: "Startup tech, stocke du matériel de salon (stands, PLV, goodies). Accès irrégulier mais important avant les événements. Contact: Alexandre Nguyen, CEO. Très satisfait, bon ambassadeur.",
    leadSource: "parrainage",
    viewedBoxSizes: [1, 3],
  },
  {
    id: "c11",
    fullName: "Romain Caron",
    firstName: "Romain",
    lastName: "Caron",
    email: "romain.caron@example.com",
    phone: "+33 6 22 33 44 55",
    createdAt: "2024-02-08T16:35:00Z",
    segment: "B2C",
    status: "active",
    preferredCenterId: "ctr-lyon-02",
    notes: "Arrivée prévue début mars.",
    walletAmount: 0,
    unpaidAmount: 22,
    address: "18 quai Claude Bernard",
    city: "Lyon",
    postalCode: "69007",
    birthDate: "1990-12-05",
    longComment: "Nouveau client, en cours de déménagement. A réservé une box 6m² pour mars. Impayé initial dû à un problème de carte bancaire, à surveiller.",
    leadSource: "site-front",
    viewedBoxSizes: [3, 6],
  },
  {
    id: "c12",
    fullName: "Maison Vignoble & Co",
    firstName: "Marie",
    lastName: "Vignoble",
    email: "logistique@vignoble-co.fr",
    phone: "+33 5 57 80 80 80",
    createdAt: "2023-12-01T11:45:00Z",
    segment: "B2B",
    status: "active",
    preferredCenterId: "ctr-bordeaux-04",
    notes: "Stockage cartons événementiel.",
    walletAmount: 135,
    unpaidAmount: 0,
    address: "Château Vignoble, Route des Grands Crus",
    city: "Bordeaux",
    postalCode: "33250",
    longComment: "Maison de vins. Stocke cartons pour événements et foires. Besoin saisonnier fort (vendanges + fêtes). Client premium, toujours ponctuel dans les paiements. Potentiel d'expansion sur un 2ème box au printemps.",
    leadSource: "landing-page",
    viewedBoxSizes: [4, 6],
  },
];

const clientBoxes: ClientBox[] = [
  {
    id: "cb1",
    clientId: "c1",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-1m2",
    startDate: "2024-01-15T10:00:00Z",
    status: "active",
    price: 59,
    channel: "marketplace",
  },
  {
    id: "cb2",
    clientId: "c2",
    centerId: "ctr-lyon-02",
    boxTypeId: "bx-lyon-02-3m2",
    startDate: "2023-11-10T09:00:00Z",
    status: "active",
    price: 129,
    channel: "kostok",
  },
  {
    id: "cb3",
    clientId: "c3",
    centerId: "ctr-marseille-03",
    boxTypeId: "bx-marseille-03-2m2",
    startDate: "2024-03-01T09:30:00Z",
    status: "upcoming",
    price: 88,
    channel: "marketplace",
  },
  {
    id: "cb4",
    clientId: "c4",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-4m2",
    startDate: "2024-01-03T08:00:00Z",
    status: "active",
    price: 126,
    channel: "kostok",
  },
  {
    id: "cb5",
    clientId: "c5",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-3m2",
    startDate: "2023-06-10T10:00:00Z",
    endDate: "2023-12-31T10:00:00Z",
    status: "ended",
    price: 109,
    channel: "marketplace",
  },
  {
    id: "cb6",
    clientId: "c6",
    centerId: "ctr-lille-05",
    boxTypeId: "bx-lille-05-2m2",
    startDate: "2024-01-08T09:00:00Z",
    status: "active",
    price: 74,
    channel: "kostok",
  },
  {
    id: "cb7",
    clientId: "c6",
    centerId: "ctr-lille-05",
    boxTypeId: "bx-lille-05-7m2",
    startDate: "2024-02-01T09:00:00Z",
    status: "active",
    price: 199,
    channel: "kostok",
  },
  {
    id: "cb8",
    clientId: "c7",
    centerId: "ctr-toulouse-06",
    boxTypeId: "bx-toulouse-06-3m2",
    startDate: "2024-02-15T09:00:00Z",
    status: "active",
    price: 101,
    channel: "marketplace",
  },
  {
    id: "cb9",
    clientId: "c8",
    centerId: "ctr-marseille-03",
    boxTypeId: "bx-marseille-03-5m2",
    startDate: "2023-12-20T09:00:00Z",
    status: "active",
    price: 155,
    channel: "kostok",
  },
  {
    id: "cb10",
    clientId: "c9",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-1m2",
    startDate: "2024-03-05T11:00:00Z",
    status: "upcoming",
    price: 52,
    channel: "marketplace",
  },
  {
    id: "cb11",
    clientId: "c10",
    centerId: "ctr-paris-01",
    boxTypeId: "bx-paris-01-1m2",
    startDate: "2023-11-12T09:00:00Z",
    status: "active",
    price: 59,
    channel: "kostok",
  },
  {
    id: "cb12",
    clientId: "c11",
    centerId: "ctr-lyon-02",
    boxTypeId: "bx-lyon-02-6m2",
    startDate: "2024-03-02T09:00:00Z",
    status: "upcoming",
    price: 182,
    channel: "marketplace",
  },
  {
    id: "cb13",
    clientId: "c12",
    centerId: "ctr-bordeaux-04",
    boxTypeId: "bx-bordeaux-04-4m2",
    startDate: "2023-12-15T09:00:00Z",
    status: "active",
    price: 126,
    channel: "kostok",
  },
];

const communications: Communication[] = [
  {
    id: "cm1",
    clientId: "c1",
    type: "call",
    direction: "outbound",
    author: "Paul (Sales)",
    timestamp: "2024-02-01T16:20:00Z",
    summary: "Explication de la différence marketplace / Kostok",
    details:
      "Appel de 10 minutes, a confirmé le choix du centre Paris 01 après comparaison avec un centre partenaire.",
    tags: ["closing", "pricing"],
  },
  {
    id: "cm2",
    clientId: "c1",
    type: "note",
    direction: "internal",
    author: "Camille (Support)",
    timestamp: "2024-02-10T11:05:00Z",
    summary: "Demande de changement de taille de box",
    details:
      "Envisage de passer sur une box légèrement plus grande si promo disponible le mois prochain.",
    tags: ["upsell"],
  },
  {
    id: "cm3",
    clientId: "c2",
    type: "email",
    direction: "inbound",
    author: "Société Dupont",
    timestamp: "2024-01-05T08:40:00Z",
    summary: "Question sur la facturation mensuelle",
    details:
      "Souhaite regrouper facturation sur une seule facture pour l&apos;ensemble des boxes.",
    tags: ["billing", "b2b"],
  },
  {
    id: "cm4",
    clientId: "c4",
    type: "email",
    direction: "outbound",
    author: "Paul (Sales)",
    timestamp: "2024-02-02T10:10:00Z",
    summary: "Proposition pack 2 boxes",
    details: "Offre envoyée avec remise 8% sur engagement 6 mois.",
    tags: ["offer", "b2b"],
  },
  {
    id: "cm5",
    clientId: "c6",
    type: "call",
    direction: "inbound",
    author: "Service client",
    timestamp: "2024-02-09T09:30:00Z",
    summary: "Ajout d'une deuxième box",
    details: "Validation de capacité logistique pour fin de trimestre.",
    tags: ["upsell"],
  },
  {
    id: "cm6",
    clientId: "c7",
    type: "chat",
    direction: "inbound",
    author: "Camille Moreau",
    timestamp: "2024-02-13T16:00:00Z",
    summary: "Question accès weekend",
    details: "Souhaite badge temporaire pour samedi.",
    tags: ["access"],
  },
  {
    id: "cm7",
    clientId: "c8",
    type: "note",
    direction: "internal",
    author: "Support",
    timestamp: "2024-01-28T12:45:00Z",
    summary: "Rappel renouvellement contrat",
    details: "Envoyer renouvellement avant le 10/03.",
    tags: ["renewal"],
  },
  {
    id: "cm8",
    clientId: "c10",
    type: "email",
    direction: "inbound",
    author: "TechNova",
    timestamp: "2024-02-06T14:20:00Z",
    summary: "Demande accès camion",
    details: "Livraison volumineuse prévue semaine prochaine.",
    tags: ["logistics"],
  },
  {
    id: "cm9",
    clientId: "c12",
    type: "call",
    direction: "outbound",
    author: "Paul (Sales)",
    timestamp: "2024-02-11T10:50:00Z",
    summary: "Validation besoin saisonnier",
    details: "Augmentation de surface possible sur avril-mai.",
    tags: ["seasonal"],
  },
];

const followUpTickets: BookingFollowUpTicket[] = [
  {
    id: "t-cc-b1",
    clientId: "c1",
    bookingId: "b1",
    title: "Gestion Coste-Centre: vérifier la mise à disposition",
    status: "open",
    createdAt: "2024-02-15T10:10:00Z",
    updatedAt: "2024-02-15T10:10:00Z",
  },
  {
    id: "t-cc-b5",
    clientId: "c4",
    bookingId: "b5",
    title: "Gestion Coste-Centre: confirmer les accès client",
    status: "closed",
    createdAt: "2024-02-05T10:00:00Z",
    updatedAt: "2024-02-06T16:20:00Z",
  },
  {
    id: "t-cc-b6",
    clientId: "c6",
    bookingId: "b6",
    title: "Gestion Coste-Centre: suivi onboarding multi-box",
    status: "open",
    createdAt: "2024-02-08T09:00:00Z",
    updatedAt: "2024-02-08T09:00:00Z",
  },
  {
    id: "t-cc-b15",
    clientId: "c2",
    bookingId: "b15",
    title: "Gestion Coste-Centre: confirmer créneau de livraison",
    status: "open",
    createdAt: "2024-02-12T09:15:00Z",
    updatedAt: "2024-02-12T09:15:00Z",
  },
];

const generatedCenterIds = [
  "ctr-paris-01",
  "ctr-lyon-02",
  "ctr-marseille-03",
  "ctr-bordeaux-04",
  "ctr-lille-05",
  "ctr-toulouse-06",
] as const;

const generatedBoxTypeIds = [
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

const generatedPrices = [59, 74, 88, 101, 126, 155, 172, 182, 199] as const;

for (let index = 13; index <= 52; index++) {
  const center = generatedCenterIds[index % generatedCenterIds.length];
  const segment = index % 2 === 0 ? "B2B" : "B2C";
  const status =
    index % 7 === 0 ? "lead" : index % 11 === 0 ? "churned" : "active";

  clients.push({
    id: `c${index}`,
    fullName: `Client Démo ${index}`,
    email: `client${index}@example.com`,
    phone: `+33 6 ${String(10 + (index % 80)).padStart(2, "0")} ${String(20 + (index % 70)).padStart(2, "0")} ${String(30 + (index % 60)).padStart(2, "0")} ${String(40 + (index % 50)).padStart(2, "0")}`,
    createdAt: new Date(Date.UTC(2023, 9 + (index % 4), 1 + (index % 27), 8 + (index % 10), 0, 0)).toISOString(),
    segment,
    status,
    preferredCenterId: center,
    notes: `Compte de démonstration ${index} pour tests de volumétrie.`,
    walletAmount: index % 3 === 0 ? 0 : 25 + (index % 7) * 10,
    unpaidAmount: index % 5 === 0 ? 0 : (index % 4) * 18,
  });

  clientBoxes.push({
    id: `cb${index + 20}`,
    clientId: `c${index}`,
    centerId: center,
    boxTypeId: generatedBoxTypeIds[index % generatedBoxTypeIds.length],
    startDate: new Date(Date.UTC(2024, index % 2, 1 + (index % 20), 9, 0, 0)).toISOString(),
    status: index % 9 === 0 ? "upcoming" : index % 10 === 0 ? "ended" : "active",
    price: generatedPrices[index % generatedPrices.length],
    channel: index % 3 === 0 ? "marketplace" : "kostok",
  });

  communications.push({
    id: `cm${index + 20}`,
    clientId: `c${index}`,
    type: index % 4 === 0 ? "email" : index % 4 === 1 ? "call" : index % 4 === 2 ? "chat" : "note",
    direction: index % 3 === 0 ? "inbound" : index % 3 === 1 ? "outbound" : "internal",
    author: index % 2 === 0 ? "Paul (Sales)" : "Camille (Support)",
    timestamp: new Date(Date.UTC(2024, 1, 1 + (index % 26), 9 + (index % 8), 10, 0)).toISOString(),
    summary: `Interaction démo #${index}`,
    details: `Communication générée automatiquement pour la fiche c${index}.`,
    tags: [segment.toLowerCase(), "generated"],
  });
}

const clientsById = new Map<string, Client>();
const clientBoxesByClientId = new Map<string, ClientBox[]>();
const communicationsByClientId = new Map<string, Communication[]>();
const followUpTicketsByClientId = new Map<string, BookingFollowUpTicket[]>();
const boxSizeByTypeId = new Map<string, number>(
  boxTypes.map((boxType) => [boxType.id, boxType.sizeM2])
);

const bookingStatusPriority: BookingStatus[] = [
  "confirmed",
  "new",
  "expired",
  "cancelled",
];

function rebuildClientIndexes() {
  clientsById.clear();
  clientBoxesByClientId.clear();
  communicationsByClientId.clear();

  clients.forEach((client) => {
    clientsById.set(client.id, client);
  });

  clientBoxes.forEach((box) => {
    const current = clientBoxesByClientId.get(box.clientId);
    if (current) current.push(box);
    else clientBoxesByClientId.set(box.clientId, [box]);
  });

  communications.forEach((communication) => {
    const current = communicationsByClientId.get(communication.clientId);
    if (current) current.push(communication);
    else communicationsByClientId.set(communication.clientId, [communication]);
  });

  followUpTicketsByClientId.clear();
  followUpTickets.forEach((ticket) => {
    const current = followUpTicketsByClientId.get(ticket.clientId);
    if (current) current.push(ticket);
    else followUpTicketsByClientId.set(ticket.clientId, [ticket]);
  });

  communicationsByClientId.forEach((items, clientId) => {
    communicationsByClientId.set(
      clientId,
      items.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    );
  });

  followUpTicketsByClientId.forEach((items, clientId) => {
    followUpTicketsByClientId.set(
      clientId,
      items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    );
  });
}

rebuildClientIndexes();

export function getClients(): Client[] {
  return clients;
}

export function getClientById(id: string): Client | undefined {
  return clientsById.get(id);
}

export function getClientBoxes(clientId: string): ClientBox[] {
  return clientBoxesByClientId.get(clientId) ?? [];
}

export function getClientCommunications(clientId: string): Communication[] {
  return communicationsByClientId.get(clientId) ?? [];
}

export function getClientBookings(clientId: string): Booking[] {
  return getBookings().filter((booking) => booking.clientId === clientId);
}

export function getClientPrimaryBookingStatus(
  clientId: string
): BookingStatus | null {
  const statuses = new Set(getClientBookings(clientId).map((booking) => booking.status));
  for (const status of bookingStatusPriority) {
    if (statuses.has(status)) return status;
  }
  return null;
}

export function getClientCumulativeStorageArea(clientId: string): number {
  return getClientBoxes(clientId).reduce((sum, box) => {
    return sum + (boxSizeByTypeId.get(box.boxTypeId) ?? 0);
  }, 0);
}

export function isVipKostokClient(clientId: string): boolean {
  return getClientCumulativeStorageArea(clientId) > 7;
}

export function getClientFollowUpTickets(clientId: string): BookingFollowUpTicket[] {
  const explicitTickets = followUpTicketsByClientId.get(clientId) ?? [];
  const explicitByBookingId = new Set(explicitTickets.map((ticket) => ticket.bookingId));

  const autoOpenTickets = getClientBookings(clientId)
    .filter((booking) => booking.status === "confirmed")
    .filter((booking) => !explicitByBookingId.has(booking.id))
    .map((booking) => ({
      id: `t-cc-${booking.id}`,
      clientId,
      bookingId: booking.id,
      title: "Gestion Coste-Centre: réservation acceptée à traiter",
      status: "open" as const,
      createdAt: booking.createdAt,
      updatedAt: booking.createdAt,
    }));

  return [...explicitTickets, ...autoOpenTickets].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function addClientCommunication(
  clientId: string,
  input: Omit<Communication, "id" | "clientId" | "timestamp">
): Communication {
  const newCommunication: Communication = {
    id: `cm-${Date.now()}`,
    clientId,
    timestamp: new Date().toISOString(),
    ...input,
  };
  communications.push(newCommunication);
  rebuildClientIndexes();
  return newCommunication;
}

function normalizePhone(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function createClientFromPhone(phoneNumber: string): Client {
  const normalizedInput = normalizePhone(phoneNumber);
  const existing = clients.find((client) => normalizePhone(client.phone) === normalizedInput);
  if (existing) return existing;

  const now = new Date().toISOString();
  const suffix = normalizedInput.slice(-8) || `${Date.now()}`.slice(-8);
  const id = `c-aircall-${Date.now()}`;

  const newClient: Client = {
    id,
    fullName: `Nouveau contact ${suffix}`,
    firstName: "Nouveau",
    lastName: `Contact ${suffix}`,
    email: `aircall+${suffix}@costockage.local`,
    phone: phoneNumber,
    createdAt: now,
    segment: "B2C",
    status: "lead",
    notes: "Créé automatiquement depuis le widget Aircall.",
    leadSource: "bot-ia",
  };

  clients.unshift(newClient);
  rebuildClientIndexes();
  return newClient;
}

