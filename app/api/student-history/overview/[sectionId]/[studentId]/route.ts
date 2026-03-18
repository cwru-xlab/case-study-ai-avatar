import { NextRequest, NextResponse } from "next/server";
import { getStudentOverview } from "@/lib/student-history-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string; studentId: string }> }
) {
  const { sectionId, studentId } = await params;

  try {
    const data = await getStudentOverview(sectionId, studentId);
    if (!data) {
      return NextResponse.json(
        { error: "Student overview not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching student overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch student overview" },
      { status: 500 }
    );
  }
}
