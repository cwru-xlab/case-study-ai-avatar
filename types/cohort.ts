/**
 * Cohort Types for Professor-side Cohort Management
 */

export type CohortMode = "practice" | "graded" | "competitive" | "simulation";

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
  caseId?: string;
  caseName?: string;
  professorId: string;
  professorName?: string;
  accessCode: string;
  maxDays: number;
  startDate: string;
  endDate: string;
  students: CohortStudent[];
  cohortMode: CohortMode;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CohortCreateInput {
  name: string;
  description?: string;
  caseId?: string;
  caseName?: string;
  professorId: string;
  professorName?: string;
  maxDays: number;
  startDate: string;
  endDate: string;
  students: CohortStudent[];
  cohortMode: CohortMode;
}

export interface CohortUpdateInput {
  name?: string;
  description?: string;
  caseId?: string;
  caseName?: string;
  maxDays?: number;
  startDate?: string;
  endDate?: string;
  students?: CohortStudent[];
  cohortMode?: CohortMode;
  isActive?: boolean;
}

export interface CachedCohort extends Cohort {
  localVersion: number;
  remoteVersion: number;
  isDirty: boolean;
}

export const COHORT_MODE_LABELS: Record<CohortMode, string> = {
  practice: "Practice Mode",
  graded: "Graded Mode",
  competitive: "Competitive Mode",
  simulation: "Simulation Mode",
};

export const COHORT_MODE_DESCRIPTIONS: Record<CohortMode, string> = {
  practice: "Students can practice without grades. Unlimited attempts allowed.",
  graded: "Student interactions are graded. Limited attempts based on budget.",
  competitive: "Students compete against each other. Leaderboard enabled.",
  simulation: "Full simulation mode with realistic scenarios and time pressure.",
};
