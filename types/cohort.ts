/**
 * Cohort Types for Professor-side Cohort Management
 */

export type CohortMode = "practice" | "graded" | "competitive" | "simulation";

export interface EnabledModes {
  video: boolean;
  voice: boolean;
  text: boolean;
}

export interface CohortStudent {
  email: string;
  joinedAt?: string;
  status?: "invited" | "joined" | "active";
}

export interface Cohort {
  id: string;
  caseId: string;
  professorId: string;
  name: string;
  accessCode: string;
  budgetPerStudent: number;
  enabledModes: EnabledModes;
  maxDays: number;
  startDate: string;
  endDate: string;
  students: CohortStudent[];
  cohortMode: CohortMode;
  bonusUnlock?: boolean;
  latePenaltyRule?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CohortCreateInput {
  caseId: string;
  professorId: string;
  name: string;
  budgetPerStudent: number;
  enabledModes: EnabledModes;
  maxDays: number;
  startDate: string;
  endDate: string;
  students: CohortStudent[];
  cohortMode: CohortMode;
  bonusUnlock?: boolean;
  latePenaltyRule?: string;
}

export interface CohortUpdateInput {
  name?: string;
  budgetPerStudent?: number;
  enabledModes?: EnabledModes;
  maxDays?: number;
  startDate?: string;
  endDate?: string;
  students?: CohortStudent[];
  cohortMode?: CohortMode;
  bonusUnlock?: boolean;
  latePenaltyRule?: string;
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

export const PRICING = {
  video: { rate: 1, minutes: 5, label: "$1 per 5 minutes" },
  voice: { rate: 1, minutes: 20, label: "$1 per 20 minutes" },
  text: { rate: 1, minutes: 30, label: "$1 per 30 minutes" },
} as const;
