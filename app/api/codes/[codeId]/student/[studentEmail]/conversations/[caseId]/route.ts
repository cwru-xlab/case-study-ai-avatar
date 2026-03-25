import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface RoleInteraction {
  roleId: string;
  roleName: string;
  messages: Message[];
  startedAt?: number;
  endedAt?: number;
}

interface ConversationSession {
  attemptNumber: number;
  logId: string;
  startedAt: string;
  completedAt: string | null;
  totalMessages: number;
  totalTimeSeconds: number;
  score: number | null;
  status: "in_progress" | "completed";
  roleInteractions: Record<string, RoleInteraction>;
  evalResult?: string;
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

    const sessions: ConversationSession[] = [];

    for (const logSummary of assessedLogs) {
      const fullLog = await s3Storage.getInteractionLog(email, caseId, logSummary.id);
      
      if (fullLog) {
        sessions.push({
          attemptNumber: fullLog.attemptNumber,
          logId: fullLog.id,
          startedAt: new Date(fullLog.startedAt).toISOString(),
          completedAt: fullLog.completedAt ? new Date(fullLog.completedAt).toISOString() : null,
          totalMessages: fullLog.totalMessages,
          totalTimeSeconds: fullLog.totalTimeSeconds,
          score: fullLog.evalScore ?? null,
          status: fullLog.status,
          roleInteractions: fullLog.roleInteractions || {},
          evalResult: fullLog.evalResult,
        });
      }
    }

    sessions.sort((a, b) => a.attemptNumber - b.attemptNumber);

    const totalMessages = sessions.reduce((sum, s) => sum + s.totalMessages, 0);
    const totalSessions = sessions.length;
    const avgMessagesPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
    const lastSession = sessions[sessions.length - 1];
    const lastConversationDate = lastSession?.startedAt || new Date().toISOString();

    return NextResponse.json({
      studentEmail: student.email,
      studentName: student.name || student.email.split("@")[0],
      caseId,
      caseName,
      cohortName: cohort.name,
      totalSessions,
      totalMessages,
      avgMessagesPerSession,
      lastConversationDate,
      sessions,
    });
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation details" },
      { status: 500 }
    );
  }
}
