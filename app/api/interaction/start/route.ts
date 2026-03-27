import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { InteractionLog } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentEmail, studentName, caseId, caseName, cohortId, mode } = body;

    if (!studentEmail || !caseId || !cohortId || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: studentEmail, caseId, cohortId, mode" },
        { status: 400 }
      );
    }

    if (mode !== "explore" && mode !== "assessed") {
      return NextResponse.json(
        { error: "Mode must be 'explore' or 'assessed'" },
        { status: 400 }
      );
    }

    const attemptNumber = mode === "assessed"
      ? await s3Storage.getNextAttemptNumber(studentEmail, caseId)
      : 0;

    const now = Date.now();
    const logId = `${now}_${Math.random().toString(36).substring(2, 9)}`;

    const log: InteractionLog = {
      id: logId,
      studentEmail: studentEmail.toLowerCase(),
      studentName: studentName || studentEmail.split("@")[0],
      caseId,
      caseName: caseName || caseId,
      cohortId,
      attemptNumber,
      mode,
      status: "in_progress",
      roleInteractions: {},
      events: [
        {
          type: "start_session",
          timestamp: now,
        },
      ],
      startedAt: now,
      lastSavedAt: now,
      totalMessages: 0,
      totalTimeSeconds: 0,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };

    // Only save assessed interactions to S3
    if (mode === "assessed") {
      await s3Storage.saveInteractionLog(log);
    }

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error("Error starting interaction:", error);
    return NextResponse.json(
      { error: "Failed to start interaction" },
      { status: 500 }
    );
  }
}
