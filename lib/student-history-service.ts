/**
 * Student History Service - PostgreSQL Data Layer
 *
 * This service provides data access for the Student History feature
 * using Prisma queries against PostgreSQL.
 */

import { prisma } from "./prisma";
import type {
  Cohort as PrismaCohort,
  Student as PrismaStudent,
  Case as PrismaCase,
  Attempt as PrismaAttempt,
  CaseAssignment,
} from "@prisma/client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CourseSection {
  id: string;
  name: string;
  code: string;
  semester: string;
  year: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  sectionIds: string[];
}

export interface Case {
  id: string;
  name: string;
  description: string;
  sectionIds: string[];
}

export interface StudentAttempt {
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  totalMessages: number;
  totalTimeSeconds: number;
}

export interface TimeUsageData {
  totalTimeMinutes: number;
  numberOfSessions: number;
  avgSessionLengthMinutes: number;
  lastActiveDate: string;
}

export interface ConversationsData {
  totalMessages: number;
  totalSessions: number;
  lastConversationDate: string;
  avgMessagesPerSession: number;
}

export interface ScoreData {
  currentScore: number | null;
  bestScore: number | null;
  numberOfAttempts: number;
  passingScore: number;
  isPassing: boolean;
}

export interface LearningCurveData {
  attempts: Array<{
    attemptNumber: number;
    score: number;
    date: string;
  }>;
  trend: "improving" | "stable" | "declining";
}

export interface StudentHistoryDetail {
  student: Student;
  section: CourseSection;
  case: Case;
  timeRange: string;
  attempts: StudentAttempt[];
  timeUsage: TimeUsageData;
  conversations: ConversationsData;
  score: ScoreData;
  learningCurve: LearningCurveData;
}

export type TimeRangeOption =
  | "last_7_days"
  | "last_30_days"
  | "last_3_months"
  | "last_6_months";

export const TIME_RANGE_OPTIONS: Array<{
  value: TimeRangeOption;
  label: string;
}> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
];

// ============================================================================
// TYPE MAPPERS
// ============================================================================

function cohortToCourseSection(cohort: PrismaCohort): CourseSection {
  return {
    id: cohort.id,
    name: cohort.name,
    code: cohort.code || cohort.name,
    semester: cohort.semester || "Unknown",
    year: cohort.year || new Date().getFullYear(),
  };
}

function prismaStudentToStudent(
  s: PrismaStudent & { assignments: CaseAssignment[] }
): Student {
  return {
    id: s.id,
    name: s.displayName || s.email.split("@")[0],
    email: s.email,
    studentNumber: s.studentNumber || s.email.split("@")[0],
    sectionIds: s.assignments
      .map((a) => a.cohortId)
      .filter((id): id is string => id !== null),
  };
}

function prismaCaseToCase(
  c: PrismaCase & { assignments: CaseAssignment[] }
): Case {
  return {
    id: c.id,
    name: c.title,
    description: c.description || "",
    sectionIds: c.assignments
      .map((a) => a.cohortId)
      .filter((id): id is string => id !== null),
  };
}

function prismaAttemptToStudentAttempt(a: PrismaAttempt): StudentAttempt {
  return {
    attemptNumber: a.attemptNumber,
    startedAt: a.createdAt.toISOString(),
    completedAt: a.submittedAt?.toISOString() || null,
    score: a.score,
    totalMessages: a.totalMessages || 0,
    totalTimeSeconds: a.totalTimeSeconds || 0,
  };
}

function getTimeRangeDate(timeRange: TimeRangeOption): Date {
  const now = new Date();
  switch (timeRange) {
    case "last_7_days":
      return new Date(now.setDate(now.getDate() - 7));
    case "last_30_days":
      return new Date(now.setDate(now.getDate() - 30));
    case "last_3_months":
      return new Date(now.setMonth(now.getMonth() - 3));
    case "last_6_months":
      return new Date(now.setMonth(now.getMonth() - 6));
    default:
      return new Date(now.setDate(now.getDate() - 30));
  }
}

function calculateTrend(
  scores: number[]
): "improving" | "stable" | "declining" {
  if (scores.length < 2) return "stable";
  const first = scores[0];
  const last = scores[scores.length - 1];
  const diff = last - first;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Get all course sections
 */
export async function getAllSections(): Promise<CourseSection[]> {
  const cohorts = await prisma.cohort.findMany({
    orderBy: { createdAt: "desc" },
  });
  return cohorts.map(cohortToCourseSection);
}

/**
 * Search sections by query string
 */
export async function searchSections(query: string): Promise<CourseSection[]> {
  const cohorts = await prisma.cohort.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return cohorts.map(cohortToCourseSection);
}

/**
 * Get students by section ID
 */
export async function getStudentsBySection(
  sectionId: string
): Promise<Student[]> {
  const students = await prisma.student.findMany({
    where: {
      assignments: {
        some: { cohortId: sectionId },
      },
    },
    include: {
      assignments: true,
    },
    orderBy: { displayName: "asc" },
  });
  return students.map(prismaStudentToStudent);
}

/**
 * Search students by query string, optionally filtered by section
 */
export async function searchStudents(
  query: string,
  sectionId?: string
): Promise<Student[]> {
  const students = await prisma.student.findMany({
    where: {
      AND: [
        sectionId
          ? {
              assignments: {
                some: { cohortId: sectionId },
              },
            }
          : {},
        {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { studentNumber: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    include: {
      assignments: true,
    },
    orderBy: { displayName: "asc" },
  });
  return students.map(prismaStudentToStudent);
}

/**
 * Get cases by section ID
 */
export async function getCasesBySection(sectionId: string): Promise<Case[]> {
  const cases = await prisma.case.findMany({
    where: {
      assignments: {
        some: { cohortId: sectionId },
      },
    },
    include: {
      assignments: true,
    },
    orderBy: { title: "asc" },
  });
  return cases.map(prismaCaseToCase);
}

/**
 * Search cases by query string, optionally filtered by section
 */
export async function searchCases(
  query: string,
  sectionId?: string
): Promise<Case[]> {
  const cases = await prisma.case.findMany({
    where: {
      AND: [
        sectionId
          ? {
              assignments: {
                some: { cohortId: sectionId },
              },
            }
          : {},
        {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    include: {
      assignments: true,
    },
    orderBy: { title: "asc" },
  });
  return cases.map(prismaCaseToCase);
}

/**
 * Get section by ID
 */
export async function getSectionById(
  sectionId: string
): Promise<CourseSection | null> {
  const cohort = await prisma.cohort.findUnique({
    where: { id: sectionId },
  });
  return cohort ? cohortToCourseSection(cohort) : null;
}

/**
 * Get student by ID
 */
export async function getStudentById(
  studentId: string
): Promise<Student | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      assignments: true,
    },
  });
  return student ? prismaStudentToStudent(student) : null;
}

/**
 * Get case by ID
 */
export async function getCaseById(caseId: string): Promise<Case | null> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      assignments: true,
    },
  });
  return caseData ? prismaCaseToCase(caseData) : null;
}

/**
 * Get detailed student history for a specific student/section/case combination
 */
export async function getStudentHistoryDetail(
  sectionId: string,
  studentId: string,
  caseId: string,
  timeRange: TimeRangeOption
): Promise<StudentHistoryDetail | null> {
  const [cohort, student, caseData, attempts] = await Promise.all([
    prisma.cohort.findUnique({ where: { id: sectionId } }),
    prisma.student.findUnique({
      where: { id: studentId },
      include: { assignments: true },
    }),
    prisma.case.findUnique({
      where: { id: caseId },
      include: { assignments: true },
    }),
    prisma.attempt.findMany({
      where: {
        studentId,
        caseId,
        createdAt: { gte: getTimeRangeDate(timeRange) },
      },
      orderBy: { attemptNumber: "asc" },
    }),
  ]);

  if (!cohort || !student || !caseData) {
    return null;
  }

  const section = cohortToCourseSection(cohort);
  const studentMapped = prismaStudentToStudent(student);
  const caseMapped = prismaCaseToCase(caseData);
  const attemptsMapped = attempts.map(prismaAttemptToStudentAttempt);

  const scores = attempts
    .map((a) => a.score)
    .filter((s): s is number => s !== null);
  const totalTimeSeconds = attempts.reduce(
    (sum, a) => sum + (a.totalTimeSeconds || 0),
    0
  );
  const totalMessages = attempts.reduce(
    (sum, a) => sum + (a.totalMessages || 0),
    0
  );

  const lastAttempt = attempts[attempts.length - 1];
  const lastActiveDate = lastAttempt
    ? (lastAttempt.submittedAt || lastAttempt.createdAt)
        .toISOString()
        .split("T")[0]
    : new Date().toISOString().split("T")[0];

  const timeRangeLabel =
    TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.label || timeRange;

  const learningCurveAttempts = attempts
    .filter((a) => a.score !== null)
    .map((a) => ({
      attemptNumber: a.attemptNumber,
      score: a.score!,
      date: a.createdAt.toISOString().split("T")[0],
    }));

  return {
    student: studentMapped,
    section,
    case: caseMapped,
    timeRange: timeRangeLabel,
    attempts: attemptsMapped,
    timeUsage: {
      totalTimeMinutes: Math.round(totalTimeSeconds / 60),
      numberOfSessions: attempts.length,
      avgSessionLengthMinutes:
        attempts.length > 0
          ? Math.round(totalTimeSeconds / 60 / attempts.length)
          : 0,
      lastActiveDate,
    },
    conversations: {
      totalMessages,
      totalSessions: attempts.length,
      lastConversationDate: lastActiveDate,
      avgMessagesPerSession:
        attempts.length > 0 ? Math.round(totalMessages / attempts.length) : 0,
    },
    score: {
      currentScore: scores.length > 0 ? scores[scores.length - 1] : null,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      numberOfAttempts: attempts.length,
      passingScore: 70,
      isPassing: scores.length > 0 && Math.max(...scores) >= 70,
    },
    learningCurve: {
      attempts: learningCurveAttempts,
      trend: calculateTrend(scores),
    },
  };
}

/**
 * Get time usage details for a specific attempt
 */
export async function getTimeUsageDetails(
  sectionId: string,
  studentId: string,
  caseId: string,
  attemptNumber?: number
): Promise<{
  sessions: Array<{
    date: string;
    durationMinutes: number;
    messagesCount: number;
  }>;
  totalTimeMinutes: number;
  peakActivityHour: number;
}> {
  const whereClause: { studentId: string; caseId: string; attemptNumber?: number } = {
    studentId,
    caseId,
  };
  if (attemptNumber !== undefined) {
    whereClause.attemptNumber = attemptNumber;
  }

  const attempts = await prisma.attempt.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
  });

  const sessions = attempts.map((a) => ({
    date: a.createdAt.toISOString().split("T")[0],
    durationMinutes: Math.round((a.totalTimeSeconds || 0) / 60),
    messagesCount: a.totalMessages || 0,
  }));

  const totalTimeMinutes = sessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  const hours = attempts.map((a) => a.createdAt.getHours());
  const hourCounts = hours.reduce(
    (acc, h) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );
  const peakActivityHour =
    Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "10";

  return {
    sessions,
    totalTimeMinutes,
    peakActivityHour: parseInt(peakActivityHour as string),
  };
}

/**
 * Get conversation details for a specific attempt
 */
export async function getConversationDetails(
  sectionId: string,
  studentId: string,
  caseId: string,
  attemptNumber?: number
): Promise<{
  conversations: Array<{
    sessionId: string;
    date: string;
    messageCount: number;
    duration: number;
    preview: string;
  }>;
}> {
  const whereClause: { studentId: string; caseId: string; attemptNumber?: number } = {
    studentId,
    caseId,
  };
  if (attemptNumber !== undefined) {
    whereClause.attemptNumber = attemptNumber;
  }

  const attempts = await prisma.attempt.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
  });

  const conversations = attempts.map((a) => ({
    sessionId: a.id,
    date: a.createdAt.toISOString().split("T")[0],
    messageCount: a.totalMessages || 0,
    duration: Math.round((a.totalTimeSeconds || 0) / 60),
    preview: `Attempt ${a.attemptNumber}`,
  }));

  return { conversations };
}

/**
 * Get score details for all attempts
 */
export async function getScoreDetails(
  sectionId: string,
  studentId: string,
  caseId: string
): Promise<{
  attempts: Array<{
    attemptNumber: number;
    score: number;
    date: string;
    breakdown: {
      category: string;
      score: number;
      maxScore: number;
    }[];
  }>;
  classAverage: number;
  percentile: number;
}> {
  const [studentAttempts, allAttempts] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId, caseId },
      orderBy: { attemptNumber: "asc" },
    }),
    prisma.attempt.findMany({
      where: { caseId },
    }),
  ]);

  const attempts = studentAttempts
    .filter((a) => a.score !== null)
    .map((a) => ({
      attemptNumber: a.attemptNumber,
      score: a.score!,
      date: a.createdAt.toISOString().split("T")[0],
      breakdown: [],
    }));

  const allScores = allAttempts
    .map((a) => a.score)
    .filter((s): s is number => s !== null);
  const classAverage =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

  const studentBestScore =
    studentAttempts.length > 0
      ? Math.max(
          ...studentAttempts
            .map((a) => a.score)
            .filter((s): s is number => s !== null)
        )
      : 0;
  const belowCount = allScores.filter((s) => s < studentBestScore).length;
  const percentile =
    allScores.length > 0 ? Math.round((belowCount / allScores.length) * 100) : 0;

  return {
    attempts,
    classAverage,
    percentile,
  };
}

/**
 * Get learning curve data with trend analysis
 */
export async function getLearningCurveDetails(
  sectionId: string,
  studentId: string,
  caseId: string
): Promise<{
  dataPoints: Array<{
    attemptNumber: number;
    score: number;
    date: string;
    timeSpentMinutes: number;
  }>;
  trend: "improving" | "stable" | "declining";
  improvementRate: number;
  predictedNextScore: number | null;
}> {
  const attempts = await prisma.attempt.findMany({
    where: { studentId, caseId },
    orderBy: { attemptNumber: "asc" },
  });

  const dataPoints = attempts
    .filter((a) => a.score !== null)
    .map((a) => ({
      attemptNumber: a.attemptNumber,
      score: a.score!,
      date: a.createdAt.toISOString().split("T")[0],
      timeSpentMinutes: Math.round((a.totalTimeSeconds || 0) / 60),
    }));

  const scores = dataPoints.map((d) => d.score);
  const trend = calculateTrend(scores);

  let improvementRate = 0;
  if (scores.length >= 2) {
    improvementRate = Math.round(
      (scores[scores.length - 1] - scores[0]) / (scores.length - 1)
    );
  }

  let predictedNextScore: number | null = null;
  if (scores.length >= 2 && improvementRate > 0) {
    predictedNextScore = Math.min(100, scores[scores.length - 1] + improvementRate);
  }

  return {
    dataPoints,
    trend,
    improvementRate,
    predictedNextScore,
  };
}

// ============================================================================
// TEACHER CLASS OVERVIEW TYPES & FUNCTIONS
// ============================================================================

export type AttemptViewMode =
  | "best"
  | "first"
  | "latest"
  | { type: "specific"; attemptNumber: number };

export interface StudentGradebookRow {
  studentId: string;
  studentName: string;
  studentNumber: string;
  attempts: StudentAttempt[];
  bestScore: number | null;
  firstAttemptScore: number | null;
  latestAttemptScore: number | null;
  maxAttemptNumber: number;
}

export interface ClassGradebookData {
  section: CourseSection;
  case: Case;
  students: StudentGradebookRow[];
  maxAttemptsInClass: number;
  classStats: {
    average: number | null;
    highest: number | null;
    lowest: number | null;
    missingCount: number;
    totalStudents: number;
  };
}

export interface ClassTrendData {
  attemptNumber: number;
  averageScore: number;
  studentCount: number;
}

export interface ClassProcessAnalytics {
  avgTimeMinutes: number;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  avgMessageCount: number;
  minMessageCount: number;
  maxMessageCount: number;
  topQuestionThemes: Array<{
    theme: string;
    count: number;
    percentage: number;
  }>;
}

export interface StudentOverviewData {
  student: Student;
  section: CourseSection;
  casesWithScores: Array<{
    case: Case;
    bestScore: number | null;
    latestScore: number | null;
    attemptCount: number;
    lastAttemptDate: string | null;
  }>;
}

/**
 * Get gradebook data for a class and case
 */
export async function getClassGradebook(
  sectionId: string,
  caseId: string
): Promise<ClassGradebookData | null> {
  const [cohort, caseData] = await Promise.all([
    prisma.cohort.findUnique({ where: { id: sectionId } }),
    prisma.case.findUnique({
      where: { id: caseId },
      include: { assignments: true },
    }),
  ]);

  if (!cohort || !caseData) {
    return null;
  }

  const studentsInSection = await prisma.student.findMany({
    where: {
      assignments: {
        some: { cohortId: sectionId },
      },
    },
    include: {
      assignments: true,
      attempts: {
        where: { caseId },
        orderBy: { attemptNumber: "asc" },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const studentRows: StudentGradebookRow[] = studentsInSection.map((student) => {
    const attempts = student.attempts.map(prismaAttemptToStudentAttempt);
    const scores = student.attempts
      .map((a) => a.score)
      .filter((s): s is number => s !== null);

    return {
      studentId: student.id,
      studentName: student.displayName || student.email.split("@")[0],
      studentNumber: student.studentNumber || student.email.split("@")[0],
      attempts,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      firstAttemptScore: student.attempts[0]?.score ?? null,
      latestAttemptScore:
        student.attempts.length > 0
          ? student.attempts[student.attempts.length - 1].score
          : null,
      maxAttemptNumber:
        student.attempts.length > 0
          ? Math.max(...student.attempts.map((a) => a.attemptNumber))
          : 0,
    };
  });

  const maxAttemptsInClass = Math.max(
    ...studentRows.map((s) => s.maxAttemptNumber),
    0
  );

  const allBestScores = studentRows
    .map((s) => s.bestScore)
    .filter((s): s is number => s !== null);

  const missingCount = studentRows.filter((s) => s.bestScore === null).length;

  return {
    section: cohortToCourseSection(cohort),
    case: prismaCaseToCase(caseData),
    students: studentRows,
    maxAttemptsInClass,
    classStats: {
      average:
        allBestScores.length > 0
          ? Math.round(
              allBestScores.reduce((a, b) => a + b, 0) / allBestScores.length
            )
          : null,
      highest: allBestScores.length > 0 ? Math.max(...allBestScores) : null,
      lowest: allBestScores.length > 0 ? Math.min(...allBestScores) : null,
      missingCount,
      totalStudents: studentRows.length,
    },
  };
}

/**
 * Get score for a student based on attempt view mode
 */
export function getScoreByAttemptMode(
  row: StudentGradebookRow,
  mode: AttemptViewMode
): number | null {
  if (mode === "best") {
    return row.bestScore;
  }
  if (mode === "first") {
    return row.firstAttemptScore;
  }
  if (mode === "latest") {
    return row.latestAttemptScore;
  }
  if (typeof mode === "object" && mode.type === "specific") {
    const attempt = row.attempts.find(
      (a) => a.attemptNumber === mode.attemptNumber
    );
    return attempt?.score ?? null;
  }
  return null;
}

/**
 * Calculate class stats based on attempt view mode
 */
export function calculateClassStats(
  students: StudentGradebookRow[],
  mode: AttemptViewMode
): {
  average: number | null;
  highest: number | null;
  lowest: number | null;
  missingCount: number;
  totalStudents: number;
} {
  const scores = students
    .map((s) => getScoreByAttemptMode(s, mode))
    .filter((s): s is number => s !== null);

  const missingCount = students.filter(
    (s) => getScoreByAttemptMode(s, mode) === null
  ).length;

  return {
    average:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    highest: scores.length > 0 ? Math.max(...scores) : null,
    lowest: scores.length > 0 ? Math.min(...scores) : null,
    missingCount,
    totalStudents: students.length,
  };
}

/**
 * Get class trend data (average score per attempt number)
 */
export async function getClassTrendData(
  sectionId: string,
  caseId: string
): Promise<ClassTrendData[]> {
  const gradebook = await getClassGradebook(sectionId, caseId);
  if (!gradebook) return [];

  const attemptScores: Record<number, number[]> = {};

  for (const student of gradebook.students) {
    for (const attempt of student.attempts) {
      if (attempt.score !== null) {
        if (!attemptScores[attempt.attemptNumber]) {
          attemptScores[attempt.attemptNumber] = [];
        }
        attemptScores[attempt.attemptNumber].push(attempt.score);
      }
    }
  }

  return Object.entries(attemptScores)
    .map(([attemptNum, scores]) => ({
      attemptNumber: parseInt(attemptNum),
      averageScore: Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      ),
      studentCount: scores.length,
    }))
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
}

/**
 * Get process/learning analytics for a class and case
 */
export async function getClassProcessAnalytics(
  sectionId: string,
  caseId: string
): Promise<ClassProcessAnalytics> {
  const studentsInSection = await prisma.student.findMany({
    where: {
      assignments: {
        some: { cohortId: sectionId },
      },
    },
    include: {
      attempts: {
        where: { caseId },
      },
    },
  });

  const allAttempts = studentsInSection.flatMap((s) => s.attempts);

  const timesMinutes = allAttempts
    .map((a) => Math.round((a.totalTimeSeconds || 0) / 60))
    .filter((t) => t > 0);
  const messageCounts = allAttempts
    .map((a) => a.totalMessages || 0)
    .filter((m) => m > 0);

  return {
    avgTimeMinutes:
      timesMinutes.length > 0
        ? Math.round(
            timesMinutes.reduce((a, b) => a + b, 0) / timesMinutes.length
          )
        : 0,
    minTimeMinutes: timesMinutes.length > 0 ? Math.min(...timesMinutes) : 0,
    maxTimeMinutes: timesMinutes.length > 0 ? Math.max(...timesMinutes) : 0,
    avgMessageCount:
      messageCounts.length > 0
        ? Math.round(
            messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length
          )
        : 0,
    minMessageCount: messageCounts.length > 0 ? Math.min(...messageCounts) : 0,
    maxMessageCount: messageCounts.length > 0 ? Math.max(...messageCounts) : 0,
    topQuestionThemes: [],
  };
}

/**
 * Get student overview across all cases in a section
 */
export async function getStudentOverview(
  sectionId: string,
  studentId: string
): Promise<StudentOverviewData | null> {
  const [cohort, student] = await Promise.all([
    prisma.cohort.findUnique({ where: { id: sectionId } }),
    prisma.student.findUnique({
      where: { id: studentId },
      include: { assignments: true },
    }),
  ]);

  if (!cohort || !student) {
    return null;
  }

  const casesInSection = await prisma.case.findMany({
    where: {
      assignments: {
        some: { cohortId: sectionId },
      },
    },
    include: {
      assignments: true,
      attempts: {
        where: { studentId },
        orderBy: { attemptNumber: "asc" },
      },
    },
  });

  const casesWithScores = casesInSection.map((caseData) => {
    const attempts = caseData.attempts;
    const scores = attempts
      .map((a) => a.score)
      .filter((s): s is number => s !== null);

    return {
      case: prismaCaseToCase(caseData),
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      latestScore:
        attempts.length > 0 ? attempts[attempts.length - 1].score : null,
      attemptCount: attempts.length,
      lastAttemptDate:
        attempts.length > 0
          ? (
              attempts[attempts.length - 1].submittedAt ||
              attempts[attempts.length - 1].createdAt
            )
              .toISOString()
              .split("T")[0]
          : null,
    };
  });

  return {
    student: prismaStudentToStudent(student),
    section: cohortToCourseSection(cohort),
    casesWithScores,
  };
}

/**
 * Export gradebook data as CSV string
 */
export function exportGradebookToCSV(
  gradebook: ClassGradebookData,
  mode: AttemptViewMode
): string {
  const headers = ["Student Name", "Student ID", "Score"];
  const rows = gradebook.students.map((student) => {
    const score = getScoreByAttemptMode(student, mode);
    return [
      student.studentName,
      student.studentNumber,
      score !== null ? score.toString() : "N/A",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
}
