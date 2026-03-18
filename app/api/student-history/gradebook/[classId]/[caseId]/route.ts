import { NextRequest, NextResponse } from "next/server";
import {
  getClassGradebook,
  getClassTrendData,
  getClassProcessAnalytics,
} from "@/lib/student-history-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; caseId: string }> }
) {
  const { classId, caseId } = await params;

  try {
    const [gradebook, trendData, processAnalytics] = await Promise.all([
      getClassGradebook(classId, caseId),
      getClassTrendData(classId, caseId),
      getClassProcessAnalytics(classId, caseId),
    ]);

    if (!gradebook) {
      return NextResponse.json(
        { error: "Class or case not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      gradebook,
      trendData,
      processAnalytics,
    });
  } catch (error) {
    console.error("Error fetching gradebook:", error);
    return NextResponse.json(
      { error: "Failed to fetch gradebook" },
      { status: 500 }
    );
  }
}
