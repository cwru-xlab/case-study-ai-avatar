import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

interface AttemptData {
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  totalMessages: number;
  totalTimeSeconds: number;
  logId: string;
}

interface CaseDetailData {
  caseId: string;
  caseName: string;
  bestScore: number | null;
  latestScore: number | null;
  attemptCount: number;
  lastAttemptDate: string | null;
  totalTimeMinutes: number;
  totalMessages: number;
  attempts: AttemptData[];
  timeUsage: {
    totalTimeMinutes: number;
    numberOfSessions: number;
    avgSessionLengthMinutes: number;
    lastActiveDate: string;
  };
  conversations: {
    totalMessages: number;
    totalSessions: number;
    lastConversationDate: string;
    avgMessagesPerSession: number;
  };
  score: {
    currentScore: number | null;
    bestScore: number | null;
    numberOfAttempts: number;
    passingScore: number;
    isPassing: boolean;
  };
  learningCurve: {
    attempts: Array<{ attemptNumber: number; score: number; date: string }>;
    trend: "improving" | "stable" | "declining";
  };
}

function calculateTrend(scores: number[]): "improving" | "stable" | "declining" {
  if (scores.length < 2) return "stable";
  const diff = scores[scores.length - 1] - scores[0];
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string; studentEmail: string }> }
) {
  try {
    const { codeId, studentEmail } = await params;
    const email = decodeURIComponent(studentEmail).toLowerCase();

    const cohort = await s3Storage.getCohort(codeId);
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    const student = cohort.students?.find(
      (s) => s.email.toLowerCase() === email
    );
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const assignedCaseIds = cohort.assignedCaseIds || [];

    if (assignedCaseIds.length === 0) {
      return NextResponse.json({
        email: student.email,
        name: student.name || student.email.split("@")[0],
        cases: [],
        overallStats: {
          totalCases: 0,
          completedCases: 0,
          avgScore: null,
          bestScore: null,
          totalTimeMinutes: 0,
          totalAttempts: 0,
        },
      });
    }

    // Fetch case names from S3
    const caseNames: Record<string, string> = {};
    for (const caseId of assignedCaseIds) {
      const caseData = await s3Storage.getCase(caseId);
      if (caseData) {
        caseNames[caseId] = caseData.name;
      } else {
        caseNames[caseId] = `Case ${caseId}`;
      }
    }

    // Build case details from S3 interaction logs
    const cases: CaseDetailData[] = [];

    for (const caseId of assignedCaseIds) {
      const logs = await s3Storage.listInteractionLogs(email, caseId);
      const assessedLogs = logs.filter((l) => l.mode === "assessed");

      const attempts: AttemptData[] = assessedLogs.map((log) => ({
        attemptNumber: log.attemptNumber,
        startedAt: new Date(log.startedAt).toISOString(),
        completedAt: log.completedAt ? new Date(log.completedAt).toISOString() : null,
        score: log.evalScore ?? null,
        totalMessages: log.totalMessages,
        totalTimeSeconds: log.totalTimeSeconds,
        logId: log.id,
      }));

      attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

      const completedAttempts = attempts.filter((a) => a.completedAt && a.score !== null);
      const scores = completedAttempts.map((a) => a.score).filter((s): s is number => s !== null);

      const totalTimeSeconds = attempts.reduce((sum, a) => sum + a.totalTimeSeconds, 0);
      const totalMessages = attempts.reduce((sum, a) => sum + a.totalMessages, 0);

      const bestScore = scores.length > 0 ? Math.max(...scores) : null;
      const latestScore = completedAttempts.length > 0 ? completedAttempts[completedAttempts.length - 1].score : null;
      const lastAttempt = attempts[attempts.length - 1];
      const lastActiveDate = lastAttempt?.startedAt.split("T")[0] || new Date().toISOString().split("T")[0];

      const learningCurveAttempts = completedAttempts
        .filter((a) => a.score !== null)
        .map((a) => ({
          attemptNumber: a.attemptNumber,
          score: a.score!,
          date: a.startedAt.split("T")[0],
        }));

      cases.push({
        caseId,
        caseName: caseNames[caseId],
        bestScore,
        latestScore,
        attemptCount: assessedLogs.length,
        lastAttemptDate: lastAttempt?.startedAt || null,
        totalTimeMinutes: Math.round(totalTimeSeconds / 60),
        totalMessages,
        attempts,
        timeUsage: {
          totalTimeMinutes: Math.round(totalTimeSeconds / 60),
          numberOfSessions: assessedLogs.length,
          avgSessionLengthMinutes: assessedLogs.length > 0 ? Math.round(totalTimeSeconds / 60 / assessedLogs.length) : 0,
          lastActiveDate,
        },
        conversations: {
          totalMessages,
          totalSessions: assessedLogs.length,
          lastConversationDate: lastActiveDate,
          avgMessagesPerSession: assessedLogs.length > 0 ? Math.round(totalMessages / assessedLogs.length) : 0,
        },
        score: {
          currentScore: latestScore,
          bestScore,
          numberOfAttempts: assessedLogs.length,
          passingScore: 70,
          isPassing: bestScore !== null && bestScore >= 70,
        },
        learningCurve: {
          attempts: learningCurveAttempts,
          trend: calculateTrend(scores),
        },
      });
    }

    const completedCases = cases.filter((c) => c.bestScore !== null);
    const allBestScores = completedCases.map((c) => c.bestScore).filter((s): s is number => s !== null);

    return NextResponse.json({
      email: student.email,
      name: student.name || student.email.split("@")[0],
      cases,
      overallStats: {
        totalCases: assignedCaseIds.length,
        completedCases: completedCases.length,
        avgScore: allBestScores.length > 0
          ? allBestScores.reduce((a, b) => a + b, 0) / allBestScores.length
          : null,
        bestScore: allBestScores.length > 0 ? Math.max(...allBestScores) : null,
        totalTimeMinutes: cases.reduce((sum, c) => sum + c.totalTimeMinutes, 0),
        totalAttempts: cases.reduce((sum, c) => sum + c.attemptCount, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching student detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch student detail" },
      { status: 500 }
    );
  }
}
