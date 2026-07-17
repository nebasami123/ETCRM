/** Flattened directory row from external businesses collection (not a CRM shell). */
export type DirectoryRow = {
  mongoBusinessId: string;
  /** Alias for pointer field naming in newer code. */
  externalBusinessId?: string;
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
};

/** @deprecated Use DirectoryRow — name reserved for Prisma RegistryLead model. */
export type RegistryLead = DirectoryRow;

export type RegistryFilters = {
  search?: string;
  region?: string;
  subcity?: string;
  /** Sector labels (englishDescription). Accepts string[] or legacy single string. */
  sector?: string | string[];
  nationality?: string;
  businessType?: string;
  capitalMin?: number;
  capitalMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  phase?: string;
  page?: number;
  pageSize?: number;
};

export type MongoBusinessSector = {
  dateRegistered?: string;
  sector?: string;
  englishDescription?: string;
  region?: string;
  subcity?: string;
  managerPhone?: string;
  businessNumber?: string;
};

export type MongoBusinessDoc = {
  _id: { toString(): string };
  tin?: string;
  businessName?: string;
  businessType?: string;
  capital?: number;
  value?: number;
  nationality?: string;
  managerFirstName?: string;
  managerLastName?: string;
  businessSectors?: MongoBusinessSector[];
};
