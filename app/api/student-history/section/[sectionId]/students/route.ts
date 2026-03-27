import { NextRequest, NextResponse } from "next/server";
import { getStudentsBySection } from "@/lib/student-history-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;

  try {
    const students = await getStudentsBySection(sectionId);
    return NextResponse.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}
