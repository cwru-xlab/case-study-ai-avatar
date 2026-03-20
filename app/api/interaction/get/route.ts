import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentEmail = searchParams.get("studentEmail");
    const caseId = searchParams.get("caseId");
    const logId = searchParams.get("logId");

    if (!studentEmail || !caseId) {
      return NextResponse.json(
        { error: "studentEmail and caseId are required" },
        { status: 400 }
      );
    }

    // If logId is provided, return a specific log
    if (logId) {
      const log = await s3Storage.getInteractionLog(studentEmail, caseId, logId);
      if (!log) {
        return NextResponse.json(
          { error: "Interaction log not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, log });
    }

    // Otherwise return the index (list of logs)
    const logs = await s3Storage.listInteractionLogs(studentEmail, caseId);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Error fetching interaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch interaction" },
      { status: 500 }
    );
  }
}
