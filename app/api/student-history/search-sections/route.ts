import { NextRequest, NextResponse } from "next/server";
import { searchSections } from "@/lib/student-history-service";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") || "";

  if (query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const sections = await searchSections(query);
    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error searching sections:", error);
    return NextResponse.json(
      { error: "Failed to search sections" },
      { status: 500 }
    );
  }
}
