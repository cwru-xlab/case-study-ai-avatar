import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

interface AttemptScore {
  attemptNumber: number;
  score: number | null;
  date: string;
  status: "completed" | "in_progress";
  improvement: number | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string; studentEmail: string; caseId: string }> }
) {
  try {
    const { codeId, studentEmail, caseId } = await params;
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

    const caseData = await s3Storage.getCase(caseId);
    const caseName = caseData?.name || `Case ${caseId}`;

    const logs = await s3Storage.listInteractionLogs(email, caseId);
    const assessedLogs = logs.filter((l) => l.mode === "assessed");

    const attempts: AttemptScore[] = [];
    let prevScore: number | null = null;

    const sortedLogs = [...assessedLogs].sort((a, b) => a.attemptNumber - b.attemptNumber);

    for (const log of sortedLogs) {
      const score = log.evalScore ?? null;
      const improvement = prevScore !== null && score !== null ? score - prevScore : null;
      
      attempts.push({
        attemptNumber: log.attemptNumber,
        score,
        date: new Date(log.startedAt).toISOString(),
        status: log.status === "completed" ? "completed" : "in_progress",
        improvement,
      });

      if (score !== null) {
        prevScore = score;
      }
    }

    const completedAttempts = attempts.filter((a) => a.status === "completed" && a.score !== null);
    const scores = completedAttempts.map((a) => a.score).filter((s): s is number => s !== null);

    const currentScore = completedAttempts.length > 0 ? completedAttempts[completedAttempts.length - 1].score : null;
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const firstScore = scores.length > 0 ? scores[0] : null;
    const lastScore = scores.length > 0 ? scores[scores.length - 1] : null;
    const improvementFromFirst = firstScore !== null && lastScore !== null ? lastScore - firstScore : null;

    const allStudentEmails = cohort.students?.map((s) => s.email.toLowerCase()) || [];
    const classScores: number[] = [];

    for (const studentEmail of allStudentEmails) {
      const studentLogs = await s3Storage.listInteractionLogs(studentEmail, caseId);
      const studentAssessedLogs = studentLogs.filter((l) => l.mode === "assessed");
      const studentScores = studentAssessedLogs
        .map((l) => l.evalScore)
        .filter((s): s is number => s !== undefined && s !== null);
      
      if (studentScores.length > 0) {
        classScores.push(Math.max(...studentScores));
      }
    }

    const classAvgScore = classScores.length > 0 ? classScores.reduce((a, b) => a + b, 0) / classScores.length : null;
    const classHighScore = classScores.length > 0 ? Math.max(...classScores) : null;

    let percentile: number | null = null;
    if (bestScore !== null && classScores.length > 0) {
      const belowCount = classScores.filter((s) => s < bestScore).length;
      percentile = Math.round((belowCount / classScores.length) * 100);
    }

    let latestEvalResult: string | null = null;
    const completedLogs = sortedLogs.filter((l) => l.status === "completed");
    if (completedLogs.length > 0) {
      const latestLog = completedLogs[completedLogs.length - 1];
      const fullLog = await s3Storage.getInteractionLog(email, caseId, latestLog.id);
      if (fullLog?.evalResult) {
        latestEvalResult = fullLog.evalResult;
      }
    }

    return NextResponse.json({
      studentEmail: student.email,
      studentName: student.name || student.email.split("@")[0],
      caseId,
      caseName,
      cohortName: cohort.name,
      currentScore,
      bestScore,
      avgScore,
      passingScore: 70,
      isPassing: bestScore !== null && bestScore >= 70,
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      improvementFromFirst,
      attempts,
      classAvgScore,
      classHighScore,
      percentile,
      latestEvalResult,
    });
  } catch (error) {
    console.error("Error fetching score details:", error);
    return NextResponse.json(
      { error: "Failed to fetch score details" },
      { status: 500 }
    );
  }
}
