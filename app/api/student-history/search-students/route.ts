import { NextRequest, NextResponse } from "next/server";
import { searchStudents } from "@/lib/student-history-service";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") || "";
  const sectionId = request.nextUrl.searchParams.get("sectionId") || undefined;

  if (query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const students = await searchStudents(query, sectionId);
    return NextResponse.json(students);
  } catch (error) {
    console.error("Error searching students:", error);
    return NextResponse.json(
      { error: "Failed to search students" },
      { status: 500 }
    );
  }
}
