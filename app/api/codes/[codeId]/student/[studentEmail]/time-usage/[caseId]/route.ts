import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

interface SessionData {
  attemptNumber: number;
  date: string;
  durationMinutes: number;
  startTime: string;
  endTime: string | null;
  status: "completed" | "in_progress";
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

    const sessions: SessionData[] = assessedLogs.map((log) => ({
      attemptNumber: log.attemptNumber,
      date: new Date(log.startedAt).toISOString().split("T")[0],
      durationMinutes: Math.round(log.totalTimeSeconds / 60),
      startTime: new Date(log.startedAt).toISOString(),
      endTime: log.completedAt ? new Date(log.completedAt).toISOString() : null,
      status: log.status === "completed" ? "completed" : "in_progress",
    }));

    sessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const totalTimeMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalSessions = sessions.length;
    const avgSessionMinutes = totalSessions > 0 ? Math.round(totalTimeMinutes / totalSessions) : 0;
    const longestSessionMinutes = sessions.length > 0 ? Math.max(...sessions.map((s) => s.durationMinutes)) : 0;
    const shortestSessionMinutes = sessions.length > 0 ? Math.min(...sessions.map((s) => s.durationMinutes)) : 0;

    const dates = sessions.map((s) => new Date(s.date));
    const firstActiveDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : new Date().toISOString();
    const lastActiveDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : new Date().toISOString();

    const dailyActivityMap: Record<string, number> = {};
    sessions.forEach((s) => {
      dailyActivityMap[s.date] = (dailyActivityMap[s.date] || 0) + s.durationMinutes;
    });

    const dailyActivity = Object.entries(dailyActivityMap)
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const peakHoursMap: Record<number, number> = {};
    sessions.forEach((s) => {
      const hour = new Date(s.startTime).getHours();
      peakHoursMap[hour] = (peakHoursMap[hour] || 0) + 1;
    });

    const peakHours = Object.entries(peakHoursMap)
      .map(([hour, count]) => ({ hour: parseInt(hour), sessions: count }))
      .sort((a, b) => b.sessions - a.sessions);

    return NextResponse.json({
      studentEmail: student.email,
      studentName: student.name || student.email.split("@")[0],
      caseId,
      caseName,
      cohortName: cohort.name,
      totalTimeMinutes,
      totalSessions,
      avgSessionMinutes,
      longestSessionMinutes,
      shortestSessionMinutes,
      lastActiveDate,
      firstActiveDate,
      sessions,
      dailyActivity,
      peakHours,
    });
  } catch (error) {
    console.error("Error fetching time usage details:", error);
    return NextResponse.json(
      { error: "Failed to fetch time usage details" },
      { status: 500 }
    );
  }
}
