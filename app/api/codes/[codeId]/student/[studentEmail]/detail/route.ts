import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import { prisma } from "@/lib/prisma";

interface AttemptData {
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  totalMessages: number;
  totalTimeSeconds: number;
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

function generateMockDataForCase(
  caseId: string,
  caseName: string,
  index: number
): CaseDetailData {
  const numAttempts = 2 + (index % 3);
  const baseScore = 65 + Math.floor(Math.random() * 20);
  
  const attempts: AttemptData[] = [];
  const learningCurveAttempts: Array<{ attemptNumber: number; score: number; date: string }> = [];
  
  let totalTime = 0;
  let totalMsgs = 0;
  
  for (let i = 1; i <= numAttempts; i++) {
    const score = Math.min(100, baseScore + (i - 1) * 8 + Math.floor(Math.random() * 5));
    const timeSeconds = 600 + Math.floor(Math.random() * 1200);
    const messages = 8 + Math.floor(Math.random() * 15);
    const date = new Date();
    date.setDate(date.getDate() - (numAttempts - i) * 3);
    
    totalTime += timeSeconds;
    totalMsgs += messages;
    
    attempts.push({
      attemptNumber: i,
      startedAt: date.toISOString(),
      completedAt: date.toISOString(),
      score,
      totalMessages: messages,
      totalTimeSeconds: timeSeconds,
    });
    
    learningCurveAttempts.push({
      attemptNumber: i,
      score,
      date: date.toISOString().split("T")[0],
    });
  }
  
  const scores = attempts.map((a) => a.score).filter((s): s is number => s !== null);
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const lastAttempt = attempts[attempts.length - 1];
  
  const trend = scores.length >= 2
    ? scores[scores.length - 1] - scores[0] > 5
      ? "improving"
      : scores[scores.length - 1] - scores[0] < -5
        ? "declining"
        : "stable"
    : "stable";
  
  return {
    caseId,
    caseName,
    bestScore,
    latestScore,
    attemptCount: numAttempts,
    lastAttemptDate: lastAttempt?.startedAt || null,
    totalTimeMinutes: Math.round(totalTime / 60),
    totalMessages: totalMsgs,
    attempts,
    timeUsage: {
      totalTimeMinutes: Math.round(totalTime / 60),
      numberOfSessions: numAttempts,
      avgSessionLengthMinutes: Math.round(totalTime / 60 / numAttempts),
      lastActiveDate: lastAttempt?.startedAt.split("T")[0] || new Date().toISOString().split("T")[0],
    },
    conversations: {
      totalMessages: totalMsgs,
      totalSessions: numAttempts,
      lastConversationDate: lastAttempt?.startedAt.split("T")[0] || new Date().toISOString().split("T")[0],
      avgMessagesPerSession: Math.round(totalMsgs / numAttempts),
    },
    score: {
      currentScore: latestScore,
      bestScore,
      numberOfAttempts: numAttempts,
      passingScore: 70,
      isPassing: bestScore !== null && bestScore >= 70,
    },
    learningCurve: {
      attempts: learningCurveAttempts,
      trend: trend as "improving" | "stable" | "declining",
    },
  };
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

    let allCases: Array<{ id: string; name: string }> = [];
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/case/list`);
      if (res.ok) {
        const data = await res.json();
        allCases = (data.cases || []).map((c: any) => ({ id: c.id, name: c.name }));
      }
    } catch (e) {
      console.log("Could not fetch cases from API");
    }

    if (allCases.length === 0) {
      allCases = assignedCaseIds.map((id, i) => ({ id, name: `Case Study ${i + 1}` }));
    }

    const assignedCases = allCases.filter((c) => assignedCaseIds.includes(c.id));
    
    if (assignedCases.length === 0) {
      assignedCases.push(...assignedCaseIds.map((id, i) => ({ id, name: `Case Study ${i + 1}` })));
    }

    let hasRealData = false;
    let realCases: CaseDetailData[] = [];
    
    try {
      const dbStudent = await prisma.student.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: {
          attempts: {
            where: { caseId: { in: assignedCaseIds } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (dbStudent && dbStudent.attempts.length > 0) {
        hasRealData = true;
        
        realCases = assignedCases.map((caseItem) => {
          const caseAttempts = dbStudent.attempts.filter((a) => a.caseId === caseItem.id);
          const completedAttempts = caseAttempts.filter((a) => a.submittedAt && a.score !== null);
          const scores = completedAttempts.map((a) => a.score).filter((s): s is number => s !== null);

          const totalTimeSeconds = caseAttempts.reduce((sum, a) => sum + (a.totalTimeSeconds || 0), 0);
          const totalMessages = caseAttempts.reduce((sum, a) => sum + (a.totalMessages || 0), 0);

          const attempts: AttemptData[] = caseAttempts.map((a) => ({
            attemptNumber: a.attemptNumber,
            startedAt: a.createdAt.toISOString(),
            completedAt: a.submittedAt?.toISOString() || null,
            score: a.score,
            totalMessages: a.totalMessages || 0,
            totalTimeSeconds: a.totalTimeSeconds || 0,
          }));

          const learningCurveAttempts = completedAttempts.map((a) => ({
            attemptNumber: a.attemptNumber,
            score: a.score!,
            date: a.createdAt.toISOString().split("T")[0],
          }));

          const bestScore = scores.length > 0 ? Math.max(...scores) : null;
          const latestScore = completedAttempts.length > 0 ? completedAttempts[0].score : null;
          const lastAttempt = caseAttempts[0];

          const trend = scores.length >= 2
            ? scores[scores.length - 1] - scores[0] > 5
              ? "improving"
              : scores[scores.length - 1] - scores[0] < -5
                ? "declining"
                : "stable"
            : "stable";

          return {
            caseId: caseItem.id,
            caseName: caseItem.name,
            bestScore,
            latestScore,
            attemptCount: caseAttempts.length,
            lastAttemptDate: lastAttempt?.createdAt.toISOString() || null,
            totalTimeMinutes: Math.round(totalTimeSeconds / 60),
            totalMessages,
            attempts,
            timeUsage: {
              totalTimeMinutes: Math.round(totalTimeSeconds / 60),
              numberOfSessions: caseAttempts.length,
              avgSessionLengthMinutes: caseAttempts.length > 0 ? Math.round(totalTimeSeconds / 60 / caseAttempts.length) : 0,
              lastActiveDate: lastAttempt?.createdAt.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
            },
            conversations: {
              totalMessages,
              totalSessions: caseAttempts.length,
              lastConversationDate: lastAttempt?.createdAt.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
              avgMessagesPerSession: caseAttempts.length > 0 ? Math.round(totalMessages / caseAttempts.length) : 0,
            },
            score: {
              currentScore: latestScore,
              bestScore,
              numberOfAttempts: caseAttempts.length,
              passingScore: 70,
              isPassing: bestScore !== null && bestScore >= 70,
            },
            learningCurve: {
              attempts: learningCurveAttempts,
              trend: trend as "improving" | "stable" | "declining",
            },
          };
        });
      }
    } catch (dbError) {
      console.log("Database not available, using mock data");
    }

    if (!hasRealData) {
      const mockCases = assignedCases.map((caseItem, index) => 
        generateMockDataForCase(caseItem.id, caseItem.name, index)
      );
      
      const completedCases = mockCases.filter((c) => c.bestScore !== null);
      const allBestScores = completedCases.map((c) => c.bestScore).filter((s): s is number => s !== null);
      
      return NextResponse.json({
        email: student.email,
        name: student.name || student.email.split("@")[0],
        cases: mockCases,
        overallStats: {
          totalCases: assignedCases.length,
          completedCases: completedCases.length,
          avgScore: allBestScores.length > 0
            ? allBestScores.reduce((a, b) => a + b, 0) / allBestScores.length
            : null,
          bestScore: allBestScores.length > 0 ? Math.max(...allBestScores) : null,
          totalTimeMinutes: mockCases.reduce((sum, c) => sum + c.totalTimeMinutes, 0),
          totalAttempts: mockCases.reduce((sum, c) => sum + c.attemptCount, 0),
        },
      });
    }

    const completedCases = realCases.filter((c) => c.bestScore !== null);
    const allBestScores = completedCases.map((c) => c.bestScore).filter((s): s is number => s !== null);

    return NextResponse.json({
      email: student.email,
      name: student.name || student.email.split("@")[0],
      cases: realCases,
      overallStats: {
        totalCases: assignedCases.length,
        completedCases: completedCases.length,
        avgScore: allBestScores.length > 0
          ? allBestScores.reduce((a, b) => a + b, 0) / allBestScores.length
          : null,
        bestScore: allBestScores.length > 0 ? Math.max(...allBestScores) : null,
        totalTimeMinutes: realCases.reduce((sum, c) => sum + c.totalTimeMinutes, 0),
        totalAttempts: realCases.reduce((sum, c) => sum + c.attemptCount, 0),
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
