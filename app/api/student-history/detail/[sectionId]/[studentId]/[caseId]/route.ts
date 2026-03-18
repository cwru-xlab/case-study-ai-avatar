import { NextRequest, NextResponse } from "next/server";
import {
  getStudentHistoryDetail,
  getTimeUsageDetails,
  getConversationDetails,
  getScoreDetails,
  getLearningCurveDetails,
  type TimeRangeOption,
} from "@/lib/student-history-service";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ sectionId: string; studentId: string; caseId: string }>;
  }
) {
  const { sectionId, studentId, caseId } = await params;
  const timeRange =
    (request.nextUrl.searchParams.get("range") as TimeRangeOption) ||
    "last_30_days";
  const module = request.nextUrl.searchParams.get("module");
  const attemptNumber = request.nextUrl.searchParams.get("attemptNumber");

  try {
    // If requesting a specific module's details
    if (module) {
      let result;
      switch (module) {
        case "time":
          result = await getTimeUsageDetails(
            sectionId,
            studentId,
            caseId,
            attemptNumber ? parseInt(attemptNumber) : undefined
          );
          break;
        case "conversations":
          result = await getConversationDetails(
            sectionId,
            studentId,
            caseId,
            attemptNumber ? parseInt(attemptNumber) : undefined
          );
          break;
        case "score":
          result = await getScoreDetails(sectionId, studentId, caseId);
          break;
        case "learning":
          result = await getLearningCurveDetails(sectionId, studentId, caseId);
          break;
        default:
          return NextResponse.json(
            { error: "Invalid module type" },
            { status: 400 }
          );
      }
      return NextResponse.json(result);
    }

    // Otherwise return the main detail data
    const data = await getStudentHistoryDetail(
      sectionId,
      studentId,
      caseId,
      timeRange
    );

    if (!data) {
      return NextResponse.json(
        { error: "Student history not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching student history detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch student history" },
      { status: 500 }
    );
  }
}
