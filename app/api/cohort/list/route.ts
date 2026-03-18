import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const professorId = searchParams.get("professorId");

    const cohorts = await s3Storage.listCohorts(professorId || undefined);

    return NextResponse.json({
      success: true,
      cohorts,
    });
  } catch (error) {
    console.error("Error listing cohorts:", error);
    return NextResponse.json(
      { error: "Failed to list cohorts" },
      { status: 500 }
    );
  }
}
