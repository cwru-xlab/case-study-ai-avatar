import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const accessCode = searchParams.get("accessCode");

    if (!id && !accessCode) {
      return NextResponse.json(
        { error: "Missing id or accessCode parameter" },
        { status: 400 }
      );
    }

    let cohort;
    if (id) {
      cohort = await s3Storage.getCohort(id);
    } else if (accessCode) {
      cohort = await s3Storage.getCohortByAccessCode(accessCode);
    }

    if (!cohort) {
      return NextResponse.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      cohort,
    });
  } catch (error) {
    console.error("Error fetching cohort:", error);
    return NextResponse.json(
      { error: "Failed to fetch cohort" },
      { status: 500 }
    );
  }
}
