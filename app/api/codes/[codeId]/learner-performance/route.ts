import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  try {
    const { codeId } = await params;

    const cohort = await s3Storage.getCohort(codeId);
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    const students = cohort.students || [];
    const assignedCaseIds = cohort.assignedCaseIds || [];

    if (students.length === 0 || assignedCaseIds.length === 0) {
      return NextResponse.json({
        performance: {},
        codeId,
        totalCases: assignedCaseIds.length,
      });
    }

    const studentEmails = students.map((s) => s.email.toLowerCase());

    // Look up interaction logs from S3 for all students
    const performance: Record<
      string,
      {
        assignedCases: number;
        completedCases: number;
        bestScore: number | null;
        avgScore: number | null;
      }
    > = {};

    for (const email of studentEmails) {
      // Check S3 for interaction logs for this student across assigned cases
      let completedCaseCount = 0;
      const bestScoresByCase: Record<string, number> = {};

      for (const caseId of assignedCaseIds) {
        try {
          const logs = await s3Storage.listInteractionLogs(email, caseId);
          const completedLogs = logs.filter((log: any) => log.status === "completed" && log.evalScore !== undefined && log.evalScore !== null);

          if (completedLogs.length > 0) {
            completedCaseCount++;
            const bestScore = Math.max(...completedLogs.map((l: any) => l.evalScore as number));
            bestScoresByCase[caseId] = bestScore;
          }
        } catch {
          // No logs found for this student/case combination
        }
      }

      const bestScores = Object.values(bestScoresByCase);
      const overallBestScore = bestScores.length > 0 ? Math.max(...bestScores) : null;
      const avgScore =
        bestScores.length > 0
          ? Math.round(bestScores.reduce((a, b) => a + b, 0) / bestScores.length)
          : null;

      performance[email] = {
        assignedCases: assignedCaseIds.length,
        completedCases: completedCaseCount,
        bestScore: overallBestScore,
        avgScore,
      };
    }

    return NextResponse.json({
      performance,
      codeId,
      totalCases: assignedCaseIds.length,
    });
  } catch (error) {
    console.error("Error fetching learner performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch learner performance" },
      { status: 500 }
    );
  }
}
