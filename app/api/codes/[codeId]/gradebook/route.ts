import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

interface CaseScore {
  caseId: string;
  caseName: string;
  bestScore: number | null;
  attemptCount: number;
  lastAttemptDate: string | null;
}

interface StudentGradebookEntry {
  email: string;
  name: string;
  cases: CaseScore[];
  averageScore: number | null;
}

interface GradebookResponse {
  students: StudentGradebookEntry[];
  cases: Array<{ id: string; name: string }>;
  cohortName: string;
}

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
    const assignedCaseIds = cohort.assignedCases?.map((a) => a.caseId) ?? cohort.assignedCaseIds ?? [];

    if (students.length === 0) {
      return NextResponse.json({
        students: [],
        cases: [],
        cohortName: cohort.name,
      } as GradebookResponse);
    }

    // Fetch case names
    const caseList: Array<{ id: string; name: string }> = [];
    for (const caseId of assignedCaseIds) {
      try {
        const caseData = await s3Storage.getCase(caseId);
        caseList.push({
          id: caseId,
          name: caseData?.name || caseId,
        });
      } catch {
        caseList.push({ id: caseId, name: caseId });
      }
    }

    // Build gradebook data for each student
    const gradebookStudents: StudentGradebookEntry[] = [];

    for (const student of students) {
      const studentEmail = student.email.toLowerCase();
      const studentCases: CaseScore[] = [];
      const allBestScores: number[] = [];

      for (const caseInfo of caseList) {
        try {
          const logs = await s3Storage.listInteractionLogs(studentEmail, caseInfo.id);
          const completedLogs = logs.filter(
            (log) => log.status === "completed" && log.evalScore !== undefined && log.evalScore !== null
          );

          if (completedLogs.length > 0) {
            const bestScore = Math.max(...completedLogs.map((l) => l.evalScore as number));
            const lastLog = completedLogs.sort((a, b) => b.startedAt - a.startedAt)[0];
            
            allBestScores.push(bestScore);
            studentCases.push({
              caseId: caseInfo.id,
              caseName: caseInfo.name,
              bestScore,
              attemptCount: completedLogs.length,
              lastAttemptDate: lastLog.completedAt 
                ? new Date(lastLog.completedAt).toISOString() 
                : new Date(lastLog.startedAt).toISOString(),
            });
          } else {
            studentCases.push({
              caseId: caseInfo.id,
              caseName: caseInfo.name,
              bestScore: null,
              attemptCount: logs.filter((l) => l.mode === "assessed").length,
              lastAttemptDate: null,
            });
          }
        } catch {
          studentCases.push({
            caseId: caseInfo.id,
            caseName: caseInfo.name,
            bestScore: null,
            attemptCount: 0,
            lastAttemptDate: null,
          });
        }
      }

      const averageScore = allBestScores.length > 0
        ? Math.round(allBestScores.reduce((a, b) => a + b, 0) / allBestScores.length)
        : null;

      gradebookStudents.push({
        email: student.email,
        name: student.name || student.email.split("@")[0],
        cases: studentCases,
        averageScore,
      });
    }

    // Sort students by name
    gradebookStudents.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      students: gradebookStudents,
      cases: caseList,
      cohortName: cohort.name,
    } as GradebookResponse);
  } catch (error) {
    console.error("Error fetching gradebook data:", error);
    return NextResponse.json(
      { error: "Failed to fetch gradebook data" },
      { status: 500 }
    );
  }
}
