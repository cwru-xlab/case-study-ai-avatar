import { NextRequest, NextResponse } from "next/server";
import { getCasesBySection } from "@/lib/student-history-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;

  try {
    const cases = await getCasesBySection(sectionId);
    return NextResponse.json(cases);
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 }
    );
  }
}
