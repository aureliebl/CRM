// Domain models for the Costockage admin

export type Channel = "marketplace" | "kostok";

export type AppRole = "admin" | "operator";

export type ClientStatus = "active" | "churned" | "lead";

export interface Client {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  createdAt: string;
  segment?: string;
  status: ClientStatus;
  preferredCenterId?: string;
  notes?: string;
  walletAmount?: number;
  unpaidAmount?: number;
  address?: string;
  city?: string;
  postalCode?: string;
  birthDate?: string;
  longComment?: string;
  leadSource?: LeadSource;
  viewedBoxSizes?: number[];
}

export type ClientBoxStatus = "active" | "ended" | "upcoming" | "cancelled";

export interface ClientBox {
  id: string;
  clientId: string;
  centerId: string;
  boxTypeId: string;
  startDate: string;
  endDate?: string;
  status: ClientBoxStatus;
  price: number;
  channel: Channel;
}

export type CommunicationType = "call" | "email" | "chat" | "note";

export type CommunicationDirection = "inbound" | "outbound" | "internal";

export interface Communication {
  id: string;
  clientId: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  author: string;
  timestamp: string;
  summary: string;
  details?: string;
  tags?: string[];
}

export interface Center {
  id: string;
  name: string;
  city: string;
  code: string;
  isKostokOwned: boolean;
  latitude?: number;
  longitude?: number;
  address?: string;
  floors?: number;
  totalBoxes?: number;
  phone?: string;
  openingHours?: string;
  manager?: string;
}

export interface BoxType {
  id: string;
  name: string;
  sizeM2: number;
  volumeM3?: number;
  heightM?: number;
  centerId?: string;
  basePrice: number;
  features?: string[];
}

export type Trend = "up" | "down" | "stable";

export interface BoxPricingHistoryPoint {
  date: string;
  price: number;
  availabilityCount: number;
}

export interface BoxPricing {
  id: string;
  boxTypeId: string;
  centerId: string;
  currentPrice: number;
  referencePrice: number;
  availabilityCount: number;
  totalUnits: number;
  trend: Trend;
  lastUpdated: string;
  history: BoxPricingHistoryPoint[];
}

export interface ContentBlock {
  id: string;
  componentId: string;
  key: string;
  language: string;
  value: string;
  description?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export type ComponentCategory =
  | "page"
  | "section"
  | "card"
  | "button"
  | "form"
  | "layout";

export interface ComponentMeta {
  id: string;
  name: string;
  path: string;
  description?: string;
  category: ComponentCategory;
  contentKeys: string[];
}

export type BookingStatus = "new" | "confirmed" | "cancelled" | "expired";

export interface Booking {
  id: string;
  clientId?: string;
  channel: Channel;
  centerId: string;
  boxTypeId: string;
  status: BookingStatus;
  createdAt: string;
  checkIn?: string;
  checkOut?: string;
  amount: number;
  source: "web" | "phone" | "partner";
  leadSource?: LeadSource;
  viewedBoxSizes?: number[];
}

export type BookingFollowUpTicketStatus = "open" | "closed";

export interface BookingFollowUpTicket {
  id: string;
  clientId: string;
  bookingId: string;
  title: string;
  status: BookingFollowUpTicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LiveUserSession {
  id: string;
  clientId?: string;
  anonymousId?: string;
  currentCenterId?: string;
  currentBoxSizeRange?: string;
  startedAt: string;
  lastSeenAt: string;
  deviceType: "desktop" | "mobile" | "tablet";
  referrer?: string;
  page: string;
}

export interface DashboardKpi {
  label: string;
  value: string;
  delta?: string;
  trend?: Trend;
  breakdown?: {
    marketplace: string;
    kostok: string;
  };
}

export interface DashboardCenterRow {
  centerId: string;
  centerName: string;
  city: string;
  occupancyRate: number;
  revenueMarketplace: number;
  revenueKostok: number;
  trend: Trend;
}

export interface DashboardStats {
  periodLabel: string;
  kpis: DashboardKpi[];
  centers: DashboardCenterRow[];
}

export type DashboardGraphType =
  | "bar"
  | "line"
  | "pie"
  | "kpi"
  | "table"
  | "scatter"
  | "map";

export type DashboardGraphSource =
  | "bookings"
  | "pricing"
  | "liveUsers"
  | "clients"
  | "external";

export type DashboardGraphAggregation = "count" | "sum" | "avg";

export type DashboardGraphSize = "S" | "M" | "L";

export type DashboardGraphValueFormat = "number" | "currency" | "percent";

export type DashboardGraphTimeGranularity = "day" | "week" | "month";

export type DashboardGraphMapRegion = "world" | "europe" | "france";

export interface DashboardGraphFilterRule {
  field: string;
  value: string;
}

export interface DashboardGraphJoinConfig {
  enabled: boolean;
  source: DashboardGraphSource;
  leftKey: string;
  rightKey: string;
}

export interface DashboardGraphConfig {
  source: DashboardGraphSource;
  connectorId?: string;
  externalTable?: string;
  chartType: DashboardGraphType;
  groupBy?: string;
  metricField?: string;
  xField?: string;
  yField?: string;
  timeField?: string;
  dateFrom?: string;
  dateTo?: string;
  timeGranularity?: DashboardGraphTimeGranularity;
  mapRegion?: DashboardGraphMapRegion;
  mapZoom?: number;
  join?: DashboardGraphJoinConfig;
  aggregation: DashboardGraphAggregation;
  limit: number;
  sortDirection: "asc" | "desc";
  color: string;
  valueFormat: DashboardGraphValueFormat;
  filters: DashboardGraphFilterRule[];
}

export interface DashboardGraph {
  id: string;
  ownerUserId: string;
  title: string;
  description?: string;
  size: DashboardGraphSize;
  layoutOrder: number;
  isShared: boolean;
  sharedFromGraphId?: string | null;
  createdAt: string;
  updatedAt: string;
  config: DashboardGraphConfig;
}

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountGroupMembership {
  accountId: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IpAllowlistEntry {
  id: string;
  ipOrCidr: string;
  label?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SecuritySettings {
  ipAllowlistEnabled: boolean;
}

// ────────────────────────────────────────────────────────────
// CRM domain types
// ────────────────────────────────────────────────────────────

export type ContractStatus = "actif" | "terminé" | "impayé" | "squatteur";

export interface Contract {
  id: string;
  clientId: string;
  centerId: string;
  boxId: string;
  boxTypeId: string;
  status: ContractStatus;
  monthlyRent: number;
  promoCode?: string;
  promoEndDate?: string;
  priceIncreaseAmount?: number;
  priceIncreaseDate?: string;
  startDate: string;
  endDate?: string;
  contractUrl: string;
}

export type InvoiceStatus = "payé" | "impayé" | "en retard";

export interface Invoice {
  id: string;
  clientId: string;
  contractId: string;
  type: "loyer" | "frais" | "avoir";
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: InvoiceStatus;
  label: string;
}

export type IndividualBoxStatus = "libre" | "occupé" | "réservé" | "maintenance";

export interface IndividualBox {
  id: string;
  boxTypeId: string;
  centerId: string;
  floor: number;
  code: string;
  status: IndividualBoxStatus;
  clientId?: string;
  contractId?: string;
  comment?: string;
  heightM: number;
  sizeM2: number;
}

export type QuoteRequestStatus = "new" | "sent" | "accepted" | "expired" | "abandoned";

export interface QuoteRequest {
  id: string;
  clientId?: string;
  fullName: string;
  email: string;
  phone?: string;
  centerId: string;
  boxSizeWanted: number;
  status: QuoteRequestStatus;
  createdAt: string;
  sentAt?: string;
  message?: string;
}

export interface UnfinishedBooking {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  centerId: string;
  boxTypeId: string;
  step: number;
  totalSteps: number;
  stoppedAt: string;
  price: number;
  source: LeadSource;
}

export type LeadSource =
  | "bot-ia"
  | "landing-page"
  | "leboncoin"
  | "site-front"
  | "facebook"
  | "google-ads"
  | "parrainage";

export interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  clientId: string;
  type: "email" | "sms";
  subject: string;
  messages: ConversationMessage[];
  createdAt: string;
}

export type ClientHistoryType =
  | "call"
  | "email"
  | "note"
  | "contract"
  | "payment"
  | "action";

export interface ClientHistoryEvent {
  id: string;
  clientId: string;
  type: ClientHistoryType;
  summary: string;
  timestamp: string;
  pinned: boolean;
  details?: string;
}

export interface PricingTier {
  id: string;
  centerId: string;
  boxSizeM2: number;
  floor: number;
  priceAbove20: number;
  priceAbove10: number;
  priceBelow10: number;
  priceBelow5: number;
  currentAvailable: number;
  totalUnits: number;
  trend: Trend;
  lastPriceChangeDate: string;
}

export type DynamicTabSource = "centers" | "clients" | "bookings" | "external";

export type DynamicTabFieldFormat = "text" | "date" | "currency" | "number" | "status-pill";

export interface DynamicTabFormatOptions {
  decimals?: number;
  rounding?: "round" | "floor" | "ceil";
  prefix?: string;
  suffix?: string;
}

export interface DynamicTabComputedColumn {
  id: string;
  name: string;
  expression: string;
  format?: DynamicTabFieldFormat;
  formatOptions?: DynamicTabFormatOptions;
}

export interface DynamicTabPillOption {
  value: string;
  label: string;
  color: string;
}

export interface DynamicTabColumnConfig {
  key: string;
  sourceField: string;
  label: string;
  format: DynamicTabFieldFormat;
  filterType?: "text" | "select" | "date" | "number" | "none";
  options?: DynamicTabPillOption[];
  formatOptions?: DynamicTabFormatOptions;
}

export interface DynamicTabJoinConfig {
  enabled: boolean;
  source: "clients" | "centers";
  leftKey: string;
  rightKey: string;
}

export interface DynamicTabMultiJoinEntry {
  id: string;
  table: string;
  leftKey: string;
  rightKey: string;
  columns: string[];
}

export interface DynamicTabRowNavigationConfig {
  enabled: boolean;
  idField: string;
  hrefBasePath: string;
}

export interface DynamicTabRowActionConfig {
  id: string;
  label: string;
  type?: "navigate" | "db-update" | "db-delete" | "api-call";
  idField: string;
  hrefBasePath: string;
  /** For db-update: which field to update */
  targetField?: string;
  /** For db-update: prompt label */
  promptLabel?: string;
  /** For api-call: external endpoint URL (POST) */
  apiUrl?: string;
  /** Confirmation message before destructive actions */
  confirmMessage?: string;
}

export interface DynamicTabDetailSectionField {
  sourceField: string;
  label: string;
  format?: DynamicTabFieldFormat;
  formatOptions?: DynamicTabFormatOptions;
  span?: 1 | 2;
}

export interface DynamicTabDetailSection {
  id: string;
  title: string;
  columns?: 1 | 2;
  fields: DynamicTabDetailSectionField[];
}

export interface DynamicTabDetailConfig {
  enabled: boolean;
  idField: string;
  titleField?: string;
  subtitleField?: string;
  sections: DynamicTabDetailSection[];
}

export interface DynamicTabConfig {
  source: DynamicTabSource;
  connectorId?: string;
  externalTable?: string;
  columns: DynamicTabColumnConfig[];
  join?: DynamicTabJoinConfig;
  joins?: DynamicTabMultiJoinEntry[];
  computedColumns?: DynamicTabComputedColumn[];
  rowNavigation?: DynamicTabRowNavigationConfig;
  rowActions?: DynamicTabRowActionConfig[];
  detailPage?: DynamicTabDetailConfig;
}

export interface DynamicTab {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  icon?: string;
  enabled: boolean;
  isSystem: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  config: DynamicTabConfig;
}

export type DataConnectorProvider = "mock" | "bigquery";

export interface DataConnector {
  id: string;
  name: string;
  provider: DataConnectorProvider;
  enabled: boolean;
  configEncrypted: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardGraphDataPoint {
  label: string;
  value: number;
}

export interface DashboardGraphScatterPoint {
  label: string;
  x: number;
  y: number;
}

export interface DashboardGraphMapPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  value: number;
}

export interface DashboardGraphComputedData {
  points: DashboardGraphDataPoint[];
  scatterPoints: DashboardGraphScatterPoint[];
  mapPoints: DashboardGraphMapPoint[];
  totalValue: number;
  formattedTotalValue: string;
  tableRows: Record<string, string | number>[];
}

export interface DashboardGraphFieldOption {
  key: string;
  label: string;
  kind: "dimension" | "metric";
}

export interface DashboardGraphSourceOption {
  source: DashboardGraphSource;
  label: string;
  fields: DashboardGraphFieldOption[];
}

