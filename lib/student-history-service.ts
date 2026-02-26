/**
 * Student History Service - Mock Data Layer
 *
 * This service provides mock data for the Student History feature.
 * It is designed to be easily replaced with PostgreSQL queries in the future.
 *
 * TODO: Replace mock data with actual PostgreSQL queries when database is ready.
 * TODO: Add proper error handling and validation.
 * TODO: Implement caching strategy for frequently accessed data.
 */

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
// MOCK DATA
// ============================================================================

const MOCK_SECTIONS: CourseSection[] = [
  {
    id: "sec-001",
    name: "Business Strategy - Section A",
    code: "MGMT 401-A",
    semester: "Fall",
    year: 2025,
  },
  {
    id: "sec-002",
    name: "Business Strategy - Section B",
    code: "MGMT 401-B",
    semester: "Fall",
    year: 2025,
  },
  {
    id: "sec-003",
    name: "Marketing Analytics",
    code: "MKTG 350",
    semester: "Fall",
    year: 2025,
  },
  {
    id: "sec-004",
    name: "Financial Management",
    code: "FNCE 301",
    semester: "Spring",
    year: 2025,
  },
  {
    id: "sec-005",
    name: "Operations Management",
    code: "OPMT 310",
    semester: "Spring",
    year: 2025,
  },
];

const MOCK_STUDENTS: Student[] = [
  {
    id: "stu-001",
    name: "Alice Johnson",
    email: "alice.johnson@case.edu",
    studentNumber: "ABC12345",
    sectionIds: ["sec-001", "sec-003"],
  },
  {
    id: "stu-002",
    name: "Bob Smith",
    email: "bob.smith@case.edu",
    studentNumber: "ABC12346",
    sectionIds: ["sec-001", "sec-004"],
  },
  {
    id: "stu-003",
    name: "Carol Williams",
    email: "carol.williams@case.edu",
    studentNumber: "ABC12347",
    sectionIds: ["sec-002", "sec-003"],
  },
  {
    id: "stu-004",
    name: "David Brown",
    email: "david.brown@case.edu",
    studentNumber: "ABC12348",
    sectionIds: ["sec-002", "sec-005"],
  },
  {
    id: "stu-005",
    name: "Emma Davis",
    email: "emma.davis@case.edu",
    studentNumber: "ABC12349",
    sectionIds: ["sec-001", "sec-002", "sec-003"],
  },
  {
    id: "stu-006",
    name: "Frank Miller",
    email: "frank.miller@case.edu",
    studentNumber: "ABC12350",
    sectionIds: ["sec-004", "sec-005"],
  },
  {
    id: "stu-007",
    name: "Grace Wilson",
    email: "grace.wilson@case.edu",
    studentNumber: "ABC12351",
    sectionIds: ["sec-001", "sec-005"],
  },
  {
    id: "stu-008",
    name: "Henry Taylor",
    email: "henry.taylor@case.edu",
    studentNumber: "ABC12352",
    sectionIds: ["sec-002", "sec-004"],
  },
];

const MOCK_CASES: Case[] = [
  {
    id: "case-001",
    name: "Market Entry Strategy",
    description: "Analyze market entry options for a tech startup",
    sectionIds: ["sec-001", "sec-002"],
  },
  {
    id: "case-002",
    name: "Supply Chain Optimization",
    description: "Optimize supply chain for a manufacturing company",
    sectionIds: ["sec-001", "sec-005"],
  },
  {
    id: "case-003",
    name: "Customer Segmentation Analysis",
    description: "Develop customer segments for targeted marketing",
    sectionIds: ["sec-003"],
  },
  {
    id: "case-004",
    name: "Investment Portfolio Review",
    description: "Review and optimize investment portfolio allocation",
    sectionIds: ["sec-004"],
  },
  {
    id: "case-005",
    name: "Digital Transformation",
    description: "Plan digital transformation for a traditional retailer",
    sectionIds: ["sec-001", "sec-002", "sec-003"],
  },
  {
    id: "case-006",
    name: "Merger & Acquisition Analysis",
    description: "Evaluate potential M&A targets",
    sectionIds: ["sec-004", "sec-005"],
  },
];

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Get all course sections
 * TODO: Replace with PostgreSQL query
 */
export async function getAllSections(): Promise<CourseSection[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));
  return MOCK_SECTIONS;
}

/**
 * Search sections by query string
 * TODO: Replace with PostgreSQL full-text search
 */
export async function searchSections(query: string): Promise<CourseSection[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  const lowerQuery = query.toLowerCase();
  return MOCK_SECTIONS.filter(
    (section) =>
      section.name.toLowerCase().includes(lowerQuery) ||
      section.code.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get students by section ID
 * TODO: Replace with PostgreSQL query with JOIN
 */
export async function getStudentsBySection(
  sectionId: string
): Promise<Student[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_STUDENTS.filter((student) =>
    student.sectionIds.includes(sectionId)
  );
}

/**
 * Search students by query string, optionally filtered by section
 * TODO: Replace with PostgreSQL full-text search
 */
export async function searchStudents(
  query: string,
  sectionId?: string
): Promise<Student[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  const lowerQuery = query.toLowerCase();

  let students = MOCK_STUDENTS;
  if (sectionId) {
    students = students.filter((s) => s.sectionIds.includes(sectionId));
  }

  return students.filter(
    (student) =>
      student.name.toLowerCase().includes(lowerQuery) ||
      student.email.toLowerCase().includes(lowerQuery) ||
      student.studentNumber.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get cases by section ID
 * TODO: Replace with PostgreSQL query with JOIN
 */
export async function getCasesBySection(sectionId: string): Promise<Case[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_CASES.filter((c) => c.sectionIds.includes(sectionId));
}

/**
 * Search cases by query string, optionally filtered by section
 * TODO: Replace with PostgreSQL full-text search
 */
export async function searchCases(
  query: string,
  sectionId?: string
): Promise<Case[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  const lowerQuery = query.toLowerCase();

  let cases = MOCK_CASES;
  if (sectionId) {
    cases = cases.filter((c) => c.sectionIds.includes(sectionId));
  }

  return cases.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get section by ID
 * TODO: Replace with PostgreSQL query
 */
export async function getSectionById(
  sectionId: string
): Promise<CourseSection | null> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_SECTIONS.find((s) => s.id === sectionId) || null;
}

/**
 * Get student by ID
 * TODO: Replace with PostgreSQL query
 */
export async function getStudentById(
  studentId: string
): Promise<Student | null> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_STUDENTS.find((s) => s.id === studentId) || null;
}

/**
 * Get case by ID
 * TODO: Replace with PostgreSQL query
 */
export async function getCaseById(caseId: string): Promise<Case | null> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_CASES.find((c) => c.id === caseId) || null;
}

/**
 * Get detailed student history for a specific student/section/case combination
 * TODO: Replace with PostgreSQL queries aggregating from chat sessions, scores, etc.
 */
export async function getStudentHistoryDetail(
  sectionId: string,
  studentId: string,
  caseId: string,
  timeRange: TimeRangeOption
): Promise<StudentHistoryDetail | null> {
  await new Promise((resolve) => setTimeout(resolve, 150));

  const section = MOCK_SECTIONS.find((s) => s.id === sectionId);
  const student = MOCK_STUDENTS.find((s) => s.id === studentId);
  const caseData = MOCK_CASES.find((c) => c.id === caseId);

  if (!section || !student || !caseData) {
    return null;
  }

  // Generate mock attempts data
  const mockAttempts: StudentAttempt[] = [
    {
      attemptNumber: 1,
      startedAt: "2025-01-15T10:30:00Z",
      completedAt: "2025-01-15T11:15:00Z",
      score: 65,
      totalMessages: 24,
      totalTimeSeconds: 2700,
    },
    {
      attemptNumber: 2,
      startedAt: "2025-01-22T14:00:00Z",
      completedAt: "2025-01-22T14:45:00Z",
      score: 78,
      totalMessages: 31,
      totalTimeSeconds: 2700,
    },
    {
      attemptNumber: 3,
      startedAt: "2025-02-01T09:00:00Z",
      completedAt: "2025-02-01T09:50:00Z",
      score: 85,
      totalMessages: 28,
      totalTimeSeconds: 3000,
    },
  ];

  const timeRangeLabel =
    TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.label || timeRange;

  return {
    student,
    section,
    case: caseData,
    timeRange: timeRangeLabel,
    attempts: mockAttempts,
    timeUsage: {
      totalTimeMinutes: 140,
      numberOfSessions: 3,
      avgSessionLengthMinutes: 47,
      lastActiveDate: "2025-02-01",
    },
    conversations: {
      totalMessages: 83,
      totalSessions: 3,
      lastConversationDate: "2025-02-01",
      avgMessagesPerSession: 28,
    },
    score: {
      currentScore: 85,
      bestScore: 85,
      numberOfAttempts: 3,
      passingScore: 70,
      isPassing: true,
    },
    learningCurve: {
      attempts: [
        { attemptNumber: 1, score: 65, date: "2025-01-15" },
        { attemptNumber: 2, score: 78, date: "2025-01-22" },
        { attemptNumber: 3, score: 85, date: "2025-02-01" },
      ],
      trend: "improving",
    },
  };
}

/**
 * Get time usage details for a specific attempt
 * TODO: Replace with PostgreSQL query
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
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    sessions: [
      { date: "2025-01-15", durationMinutes: 45, messagesCount: 24 },
      { date: "2025-01-22", durationMinutes: 45, messagesCount: 31 },
      { date: "2025-02-01", durationMinutes: 50, messagesCount: 28 },
    ],
    totalTimeMinutes: 140,
    peakActivityHour: 10,
  };
}

/**
 * Get conversation details for a specific attempt
 * TODO: Replace with PostgreSQL query joining chat sessions
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
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    conversations: [
      {
        sessionId: "sess-001",
        date: "2025-01-15",
        messageCount: 24,
        duration: 45,
        preview: "Started with market analysis questions...",
      },
      {
        sessionId: "sess-002",
        date: "2025-01-22",
        messageCount: 31,
        duration: 45,
        preview: "Focused on competitive positioning...",
      },
      {
        sessionId: "sess-003",
        date: "2025-02-01",
        messageCount: 28,
        duration: 50,
        preview: "Final review and strategy refinement...",
      },
    ],
  };
}

/**
 * Get score details for all attempts
 * TODO: Replace with PostgreSQL query
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
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    attempts: [
      {
        attemptNumber: 1,
        score: 65,
        date: "2025-01-15",
        breakdown: [
          { category: "Analysis", score: 18, maxScore: 30 },
          { category: "Strategy", score: 22, maxScore: 35 },
          { category: "Communication", score: 25, maxScore: 35 },
        ],
      },
      {
        attemptNumber: 2,
        score: 78,
        date: "2025-01-22",
        breakdown: [
          { category: "Analysis", score: 24, maxScore: 30 },
          { category: "Strategy", score: 26, maxScore: 35 },
          { category: "Communication", score: 28, maxScore: 35 },
        ],
      },
      {
        attemptNumber: 3,
        score: 85,
        date: "2025-02-01",
        breakdown: [
          { category: "Analysis", score: 27, maxScore: 30 },
          { category: "Strategy", score: 28, maxScore: 35 },
          { category: "Communication", score: 30, maxScore: 35 },
        ],
      },
    ],
    classAverage: 72,
    percentile: 85,
  };
}

/**
 * Get learning curve data with trend analysis
 * TODO: Replace with PostgreSQL query with analytics
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
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    dataPoints: [
      { attemptNumber: 1, score: 65, date: "2025-01-15", timeSpentMinutes: 45 },
      { attemptNumber: 2, score: 78, date: "2025-01-22", timeSpentMinutes: 45 },
      { attemptNumber: 3, score: 85, date: "2025-02-01", timeSpentMinutes: 50 },
    ],
    trend: "improving",
    improvementRate: 10,
    predictedNextScore: 90,
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

// Mock data for student attempts per case (for gradebook)
const MOCK_STUDENT_CASE_ATTEMPTS: Record<
  string,
  Record<string, StudentAttempt[]>
> = {
  "stu-001": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-15T10:30:00Z",
        completedAt: "2025-01-15T11:15:00Z",
        score: 72,
        totalMessages: 24,
        totalTimeSeconds: 2700,
      },
      {
        attemptNumber: 2,
        startedAt: "2025-01-22T14:00:00Z",
        completedAt: "2025-01-22T14:45:00Z",
        score: 85,
        totalMessages: 31,
        totalTimeSeconds: 2700,
      },
    ],
    "case-002": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-18T09:00:00Z",
        completedAt: "2025-01-18T09:50:00Z",
        score: 78,
        totalMessages: 22,
        totalTimeSeconds: 3000,
      },
    ],
    "case-005": [
      {
        attemptNumber: 1,
        startedAt: "2025-02-01T10:00:00Z",
        completedAt: "2025-02-01T10:45:00Z",
        score: 88,
        totalMessages: 26,
        totalTimeSeconds: 2700,
      },
    ],
  },
  "stu-002": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-16T11:00:00Z",
        completedAt: "2025-01-16T11:40:00Z",
        score: 65,
        totalMessages: 20,
        totalTimeSeconds: 2400,
      },
      {
        attemptNumber: 2,
        startedAt: "2025-01-23T15:00:00Z",
        completedAt: "2025-01-23T15:50:00Z",
        score: 71,
        totalMessages: 28,
        totalTimeSeconds: 3000,
      },
      {
        attemptNumber: 3,
        startedAt: "2025-02-02T09:00:00Z",
        completedAt: "2025-02-02T09:55:00Z",
        score: 79,
        totalMessages: 32,
        totalTimeSeconds: 3300,
      },
    ],
    "case-002": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-20T14:00:00Z",
        completedAt: "2025-01-20T14:35:00Z",
        score: 82,
        totalMessages: 25,
        totalTimeSeconds: 2100,
      },
    ],
  },
  "stu-005": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-17T10:00:00Z",
        completedAt: "2025-01-17T10:50:00Z",
        score: 91,
        totalMessages: 30,
        totalTimeSeconds: 3000,
      },
    ],
    "case-005": [
      {
        attemptNumber: 1,
        startedAt: "2025-02-03T11:00:00Z",
        completedAt: "2025-02-03T11:40:00Z",
        score: 95,
        totalMessages: 28,
        totalTimeSeconds: 2400,
      },
    ],
  },
  "stu-007": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-18T13:00:00Z",
        completedAt: "2025-01-18T13:45:00Z",
        score: 58,
        totalMessages: 18,
        totalTimeSeconds: 2700,
      },
      {
        attemptNumber: 2,
        startedAt: "2025-01-25T10:00:00Z",
        completedAt: "2025-01-25T10:55:00Z",
        score: 67,
        totalMessages: 24,
        totalTimeSeconds: 3300,
      },
    ],
    "case-002": [],
  },
  "stu-003": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-19T09:30:00Z",
        completedAt: "2025-01-19T10:20:00Z",
        score: 76,
        totalMessages: 27,
        totalTimeSeconds: 3000,
      },
    ],
    "case-005": [
      {
        attemptNumber: 1,
        startedAt: "2025-02-04T14:00:00Z",
        completedAt: "2025-02-04T14:50:00Z",
        score: 83,
        totalMessages: 29,
        totalTimeSeconds: 3000,
      },
    ],
  },
  "stu-004": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-20T11:00:00Z",
        completedAt: "2025-01-20T11:45:00Z",
        score: 69,
        totalMessages: 22,
        totalTimeSeconds: 2700,
      },
    ],
    "case-005": [],
  },
  "stu-008": {
    "case-001": [
      {
        attemptNumber: 1,
        startedAt: "2025-01-21T10:00:00Z",
        completedAt: "2025-01-21T10:40:00Z",
        score: 74,
        totalMessages: 25,
        totalTimeSeconds: 2400,
      },
      {
        attemptNumber: 2,
        startedAt: "2025-01-28T14:00:00Z",
        completedAt: "2025-01-28T14:55:00Z",
        score: 81,
        totalMessages: 30,
        totalTimeSeconds: 3300,
      },
    ],
  },
};

/**
 * Get gradebook data for a class and case
 * TODO: Replace with PostgreSQL query aggregating student attempts
 */
export async function getClassGradebook(
  sectionId: string,
  caseId: string
): Promise<ClassGradebookData | null> {
  await new Promise((resolve) => setTimeout(resolve, 150));

  const section = MOCK_SECTIONS.find((s) => s.id === sectionId);
  const caseData = MOCK_CASES.find((c) => c.id === caseId);

  if (!section || !caseData) {
    return null;
  }

  const studentsInSection = MOCK_STUDENTS.filter((s) =>
    s.sectionIds.includes(sectionId)
  );

  const studentRows: StudentGradebookRow[] = studentsInSection.map(
    (student) => {
      const attempts =
        MOCK_STUDENT_CASE_ATTEMPTS[student.id]?.[caseId] || [];
      const scores = attempts
        .map((a) => a.score)
        .filter((s): s is number => s !== null);

      return {
        studentId: student.id,
        studentName: student.name,
        studentNumber: student.studentNumber,
        attempts,
        bestScore: scores.length > 0 ? Math.max(...scores) : null,
        firstAttemptScore: attempts[0]?.score ?? null,
        latestAttemptScore:
          attempts.length > 0 ? attempts[attempts.length - 1].score : null,
        maxAttemptNumber:
          attempts.length > 0
            ? Math.max(...attempts.map((a) => a.attemptNumber))
            : 0,
      };
    }
  );

  const maxAttemptsInClass = Math.max(
    ...studentRows.map((s) => s.maxAttemptNumber),
    0
  );

  const allBestScores = studentRows
    .map((s) => s.bestScore)
    .filter((s): s is number => s !== null);

  const missingCount = studentRows.filter((s) => s.bestScore === null).length;

  return {
    section,
    case: caseData,
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
 * TODO: Replace with PostgreSQL aggregation query
 */
export async function getClassTrendData(
  sectionId: string,
  caseId: string
): Promise<ClassTrendData[]> {
  await new Promise((resolve) => setTimeout(resolve, 100));

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
 * TODO: Replace with PostgreSQL aggregation and NLP pipeline for question themes
 */
export async function getClassProcessAnalytics(
  sectionId: string,
  caseId: string
): Promise<ClassProcessAnalytics> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Mock data - in production this would aggregate from chat sessions
  return {
    avgTimeMinutes: 42,
    minTimeMinutes: 25,
    maxTimeMinutes: 65,
    avgMessageCount: 26,
    minMessageCount: 15,
    maxMessageCount: 38,
    topQuestionThemes: [
      { theme: "Market Analysis", count: 45, percentage: 28 },
      { theme: "Competitive Strategy", count: 38, percentage: 24 },
      { theme: "Financial Projections", count: 32, percentage: 20 },
      { theme: "Risk Assessment", count: 25, percentage: 16 },
      { theme: "Implementation Timeline", count: 19, percentage: 12 },
    ],
  };
}

/**
 * Get student overview across all cases in a section
 * TODO: Replace with PostgreSQL query
 */
export async function getStudentOverview(
  sectionId: string,
  studentId: string
): Promise<StudentOverviewData | null> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const section = MOCK_SECTIONS.find((s) => s.id === sectionId);
  const student = MOCK_STUDENTS.find((s) => s.id === studentId);

  if (!section || !student) {
    return null;
  }

  const casesInSection = MOCK_CASES.filter((c) =>
    c.sectionIds.includes(sectionId)
  );

  const casesWithScores = casesInSection.map((caseData) => {
    const attempts =
      MOCK_STUDENT_CASE_ATTEMPTS[studentId]?.[caseData.id] || [];
    const scores = attempts
      .map((a) => a.score)
      .filter((s): s is number => s !== null);

    return {
      case: caseData,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      latestScore:
        attempts.length > 0 ? attempts[attempts.length - 1].score : null,
      attemptCount: attempts.length,
      lastAttemptDate:
        attempts.length > 0
          ? attempts[attempts.length - 1].completedAt ||
            attempts[attempts.length - 1].startedAt
          : null,
    };
  });

  return {
    student,
    section,
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
