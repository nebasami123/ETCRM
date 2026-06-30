import type { FormEvent, ReactNode } from "react";

export type Role = "ADMIN" | "SALES";
export type LeadPhase = "NEW" | "CONTACTED" | "FOLLOW_UP" | "CLOSED_WON" | "CLOSED_LOST";
export type ActivityType = "CALL_NOTE" | "PHASE_CHANGE" | "APPOINTMENT_SET" | "LEAD_CREATED" | "LEAD_ASSIGNED";

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

export interface Lead {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  phase: LeadPhase;
  assignedTo?: UserSummary | null;
  createdBy?: UserSummary | null;
  assignedToId?: string | null;
  createdById?: string | null;
  appointmentDate?: DateValue;
  followUpDate?: DateValue;
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
  callNotes?: CallNote[];
}

export interface CallNote {
  id: string;
  note: string;
  createdAt: DateValue;
  agent: UserSummary;
}

export interface AdminSummary {
  leads: number;
  salesUsers: number;
  followUps: number;
  won: number;
  lost: number;
  unassigned: number;
  salesCreatedToday: number;
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
  metadata?: string | null;
  createdAt: DateValue;
  user?: UserSummary | null;
  lead?: Pick<Lead, "id" | "fullName" | "phoneNumber" | "phase"> | null;
}

export interface LeadFilters {
  search: string;
  phase: LeadPhase | "ALL";
  assignedToId: string;
  createdById: string;
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

export interface SalesUserForm {
  name: string;
  email: string;
  password: string;
}

export interface UploadResult {
  imported: number;
  skipped: number;
  skippedRows?: Array<{ row: number; reason: string; lead?: string }>;
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
}

export type SubmitHandler = (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
export type ChildrenProps = { children: ReactNode };
