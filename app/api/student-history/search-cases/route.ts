import { NextRequest, NextResponse } from "next/server";
import { searchCases } from "@/lib/student-history-service";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") || "";
  const sectionId = request.nextUrl.searchParams.get("sectionId") || undefined;

  if (query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const cases = await searchCases(query, sectionId);
    return NextResponse.json(cases);
  } catch (error) {
    console.error("Error searching cases:", error);
    return NextResponse.json(
      { error: "Failed to search cases" },
      { status: 500 }
    );
  }
}
