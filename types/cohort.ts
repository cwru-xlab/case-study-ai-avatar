/**
 * Cohort Types for Professor-side Cohort Management
 */

export type AccessMode = "anyone" | "specific";

export interface CohortStudent {
  email: string;
  name?: string;
  joinedAt?: string;
  status: "invited" | "joined" | "active" | "completed";
}

export interface Cohort {
  id: string;
  name: string;
  description?: string;
  professorId: string;
  professorName?: string;
  accessCode: string;
  accessMode: AccessMode;
  availableDate: string | null; // null means "Now" (immediately available)
  expirationDate: string | null; // null means "Never" (no expiration)
  assignedCaseIds: string[];  // Cases assigned to this cohort (following Alfred's pattern)
  students: CohortStudent[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CohortCreateInput {
  name: string;
  description?: string;
  professorId: string;
  professorName?: string;
  accessMode: AccessMode;
  availableDate: string | null;
  expirationDate: string | null;
  assignedCaseIds?: string[];
  students: CohortStudent[];
}

export interface CohortUpdateInput {
  name?: string;
  description?: string;
  accessMode?: AccessMode;
  availableDate?: string | null;
  expirationDate?: string | null;
  assignedCaseIds?: string[];
  students?: CohortStudent[];
  isActive?: boolean;
}

export interface CachedCohort extends Cohort {
  localVersion: number;
  remoteVersion: number;
  isDirty: boolean;
}

export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  anyone: "Anyone with the access code can join",
  specific: "Allow access only to specific learners",
};
