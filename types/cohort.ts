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

export interface CohortCaseAssignment {
  caseId: string;
  heygenMinutesLimit: number | null; // null = no limit
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
  assignedCaseIds?: string[];  // Legacy field — prefer assignedCases
  assignedCases: CohortCaseAssignment[];
  students: CohortStudent[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  passingScore: number; // Passing score threshold (default 70)
}

export interface CohortCreateInput {
  name: string;
  description?: string;
  professorId: string;
  professorName?: string;
  accessMode: AccessMode;
  availableDate: string | null;
  expirationDate: string | null;
  assignedCases?: CohortCaseAssignment[];
  students: CohortStudent[];
  passingScore?: number; // Passing score threshold (default 70)
}

export interface CohortUpdateInput {
  name?: string;
  description?: string;
  accessMode?: AccessMode;
  availableDate?: string | null;
  expirationDate?: string | null;
  assignedCases?: CohortCaseAssignment[];
  students?: CohortStudent[];
  isActive?: boolean;
  passingScore?: number; // Passing score threshold
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
