import type { FormEvent, ReactNode } from "react";

export type Role = "ADMIN" | "SALES";
export type LeadPhase = "NEW" | "CONTACTED" | "FOLLOW_UP" | "N_A" | "CLOSED_WON" | "CLOSED_LOST";
export type ActivityType =
  | "CALL_NOTE"
  | "PHASE_CHANGED"
  | "APPOINTMENT_SET"
  | "FOLLOW_UP_SET"
  | "LEAD_CREATED"
  | "LEAD_IMPORTED"
  | "LEAD_CLAIMED"
  | "LEAD_UPDATED"
  | "CLAIM_TRANSFER_REQUESTED"
  | "CLAIM_TRANSFER_APPROVED"
  | "CLAIM_TRANSFER_REJECTED";

export type DateValue = string | Date | null | undefined;

export interface UserSummary {
  id: string;
  name: string;
  email?: string;
  role?: Role;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export type LeadSource = "LOCAL" | "MONGO";

export interface Lead {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  /** True when the sales API returned safe placeholder contact details. */
  contactMasked?: boolean;
  phase: LeadPhase;
  source?: LeadSource;
  /** Directory business pointer (API still uses mongoBusinessId for compatibility). */
  mongoBusinessId?: string | null;
  externalBusinessId?: string | null;
  /** LOCAL | REGISTRY | VIRTUAL — optional; prefer source when absent. */
  kind?: "LOCAL" | "REGISTRY" | "VIRTUAL";
  /** True when this row is a live directory lead not yet materialized in Postgres. */
  isVirtual?: boolean;
  claimedBy?: UserSummary | null;
  createdBy?: UserSummary | null;
  claimedById?: string | null;
  claimedAt?: DateValue;
  createdById?: string | null;
  appointmentDate?: DateValue;
  nextFollowUpAt?: DateValue;
  dateRegistered?: DateValue;
  renewedTo?: DateValue;
  businessName?: string | null;
  businessNameAmharic?: string | null;
  legalStatusNameEng?: string | null;
  legalStatusNameAmh?: string | null;
  licenceNumber?: string | null;
  businessRegion?: string | null;
  businessZone?: string | null;
  businessWoreda?: string | null;
  businessKebele?: string | null;
  houseNumber?: string | null;
  businessTelephone?: string | null;
  managerFName?: string | null;
  managerMName?: string | null;
  managerLName?: string | null;
  englishDescription?: string | null;
  subGroupEn?: string | null;
  registryHydrated?: boolean;
  registry?: {
    capital?: number;
    value?: number;
    nationality?: string;
    tin?: string;
  };
  events?: Activity[];
}

export interface RegistryLead {
  mongoBusinessId: string;
  tin: string;
  phoneNumber: string;
  phoneKey: string;
  fullName: string;
  businessName: string;
  businessType: string;
  capital: number;
  value: number;
  nationality: string;
  managerFirstName: string;
  managerLastName: string;
  dateRegistered: string;
  sector: string;
  sectorCategory: string;
  region: string;
  subcity: string;
  managerPhone: string;
  businessNumber: string;
  crmLeadId: string | null;
  crmPhase: string | null;
  claimedById: string | null;
  claimedByName: string | null;
  inCrm: boolean;
  contactMasked?: boolean;
}

export interface RegistryFilters {
  search: string;
  region: string;
  subcity: string;
  sector: string | string[];
  nationality: string;
  businessType: string;
  capitalMin: string;
  capitalMax: string;
  page: number;
  pageSize: number;
}

export interface LeadLocationFilterOptions {
  regions: string[];
  subcities: string[];
  sectors: string[];
}

export interface RegistryFilterOptions extends LeadLocationFilterOptions {
  nationalities: string[];
  businessTypes: string[];
}

export interface AdminSummary {
  leads: number;
  salesUsers: number;
  followUps: number;
  won: number;
  lost: number;
  unclaimed: number;
  salesCreatedToday: number;
  pendingTransfers?: number;
}

export interface AdminOverviewAggregates {
  phaseCounts: Array<{ phase: LeadPhase; count: number }>;
  agentOutcomes: Array<{ userId: string; name: string; won: number; lost: number; pending: number }>;
  activityMix: Array<{ type: ActivityType; count: number }>;
}

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
export type CampaignSortMode = "capital_desc" | "capital_asc" | "value_desc" | "value_asc" | "random";

export interface CampaignFilters {
  region?: string;
  subcity?: string;
  sector?: string[];
  nationality?: string;
  businessType?: string;
  capitalMin?: number;
  capitalMax?: number;
  scoreMin?: number;
  scoreMax?: number;
}

export interface CampaignAllocation {
  userId: string;
  count: number;
  dailyContactGoal?: number;
}

export interface CampaignStats {
  total: number;
  newCount: number;
  contacted: number;
  followUp: number;
  won: number;
  lost: number;
  worked: number;
  progressPct: number;
  unlinked?: number;
  byAgent?: Array<{
    userId: string;
    name: string;
    total: number;
    newCount: number;
    contacted: number;
    followUp: number;
    won: number;
    lost: number;
  }>;
}

export interface CampaignMember {
  campaignId: string;
  userId: string;
  targetCount: number;
  dailyContactGoal?: number;
  user: UserSummary;
}

export interface Campaign {
  id: string;
  name: string;
  label?: string | null;
  description?: string | null;
  status: CampaignStatus;
  filters: CampaignFilters | Record<string, unknown>;
  sortMode: CampaignSortMode | string;
  durationDays?: number;
  startsAt?: DateValue;
  endsAt?: DateValue;
  createdById: string;
  createdBy?: UserSummary;
  assignedAt?: DateValue;
  closedAt?: DateValue;
  createdAt: DateValue;
  updatedAt?: DateValue;
  members?: CampaignMember[];
  stats?: CampaignStats;
  _count?: { leads: number };
  leads?: CampaignLeadRow[];
}

export interface CampaignAnalyticsRow {
  id: string;
  name: string;
  label?: string | null;
  status: CampaignStatus;
  durationDays: number;
  startsAt?: DateValue;
  endsAt?: DateValue;
  assignedAt?: DateValue;
  agentCount: number;
  stats: {
    total: number;
    newCount: number;
    working: number;
    won: number;
    lost: number;
    worked: number;
    progressPct: number;
    winRate: number;
  };
}

export interface CampaignLeadRow {
  id: string;
  phoneKey: string;
  phoneNumber: string;
  fullName: string;
  businessName?: string | null;
  capital?: number | null;
  region?: string | null;
  subcity?: string | null;
  leadId?: string | null;
  assignedToId?: string | null;
  assignedAt?: DateValue;
  assignedTo?: UserSummary | null;
  lead?: { id: string; phase: LeadPhase; claimedById?: string | null; claimedAt?: DateValue } | null;
}

export interface CampaignPreview {
  requested: number;
  matched: number;
  scannedBusinesses: number;
  exhausted: boolean;
  approximateBusinesses: number;
  businessCountAvailable: boolean;
  excludedPhoneCount: number;
  sample: Array<{
    fullName: string;
    businessName: string;
    phoneNumber: string;
    capital: number;
    region: string;
    subcity: string;
  }>;
}

export interface SalesCampaign {
  id: string;
  name: string;
  label?: string | null;
  description?: string | null;
  status: CampaignStatus;
  assignedAt?: DateValue;
  createdAt: DateValue;
  targetCount: number;
  stats: { total: number; remaining: number; won: number; lost: number };
}

export interface Quota {
  id?: string;
  salesUserId: string;
  date: DateValue;
  callsTarget: number;
  leadsTarget: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  metadata?: unknown;
  createdAt: DateValue;
  actor?: UserSummary | null;
  creditedUser?: UserSummary | null;
  note?: string | null;
  fromPhase?: LeadPhase | null;
  toPhase?: LeadPhase | null;
  lead?: Pick<Lead, "id" | "fullName" | "phoneNumber" | "phase"> | null;
}

export interface LeadFilters {
  search: string;
  phase: LeadPhase | "ALL";
  claimedById: string;
  createdById: string;
  region: string;
  subcity: string;
  sector: string[];
  source: LeadSource | "ALL" | "";
}

export interface AdminLeadForm {
  fullName: string;
  phoneNumber: string;
  email: string;
  assignedToId: string;
  businessName: string;
  licenceNumber: string;
  businessRegion: string;
  businessWoreda: string;
  appointmentDate?: string;
}

export interface SalesLeadForm {
  fullName: string;
  phoneNumber: string;
  email: string;
  businessName: string;
  licenceNumber: string;
  businessRegion: string;
  businessWoreda: string;
  appointmentDate: string;
  assignedToId?: string;
}

export type LeadFormState = AdminLeadForm | SalesLeadForm;

/** Concrete shape produced by the LeadForm component's handleSubmit */
export interface LeadFormData {
  fullName: string;
  phoneNumber: string;
  email: string;
  businessName: string;
  licenceNumber: string;
  businessRegion: string;
  businessWoreda: string;
  appointmentDate: string | null;
  assignedToId?: string;
}

export interface SalesUserForm {
  name: string;
  email: string;
  password: string;
}

export interface UploadResult {
  imported: number;
  skipped: number;
  skippedRows?: Array<{ row: number; reason: string; lead?: string }>;
  skippedByReason?: Array<{ reason: string; count: number }>;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedLeads {
  leads: Lead[];
  pagination: Pagination;
}

export interface SalesDashboardData {
  quota: {
    callsTarget: number;
    leadsTarget: number;
    date?: DateValue;
  };
  progress: {
    callsCompleted: number;
    leadsProcessed: number;
  };
  todoLeads: Lead[];
  phaseCounts: Array<{ phase: LeadPhase; _count: { phase: number } }>;
  reminders: Reminder[];
  overdueFollowUps?: Array<{ id: string; fullName: string; nextFollowUpAt: DateValue; phase: LeadPhase }>;
  overdueCount?: number;
}

export interface Reminder {
  id: string;
  label: string;
  note?: string | null;
  dueAt: DateValue;
  completedAt?: DateValue;
}

export type SalesTaskKind = "REMINDER" | "APPOINTMENT" | "FOLLOW_UP";
export interface SalesTask {
  id: string;
  kind: SalesTaskKind;
  label: string;
  note?: string | null;
  dueAt: DateValue;
  completedAt?: DateValue;
  leadId?: string;
  phase?: LeadPhase;
}

export interface CampaignContactGoal {
  campaignId: string;
  name: string;
  label?: string | null;
  target: number;
  completed: number;
}

export interface SalesTaskData {
  tasks: SalesTask[];
  campaignGoals?: CampaignContactGoal[];
  stats: {
    openTasks: number;
    callsCompleted: number;
    callsTarget: number;
    appointments: number;
    followUps: number;
    reminders: number;
    overdueFollowUps?: number;
    campaignContactTarget?: number;
    campaignContactCompleted?: number;
  };
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  claimedLeads: number;
  conversions: number;
  losses: number;
  conversionRate: number;
  callNotes: number;
  totalActivity: number;
}

export type SubmitHandler = (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
export type ChildrenProps = { children: ReactNode };

export interface AgentPerformanceMetrics {
  agent: string;
  email: string;
  claimedLeads: number;
  createdLeads: number;
  callNotes: number;
  activities: number;
  conversionsCredited: number;
  quotaDays: number;
  totalCallTarget: number;
  totalLeadTarget: number;
}
