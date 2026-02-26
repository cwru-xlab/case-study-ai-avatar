import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Cohort } from "@/types/cohort";

export async function POST(request: NextRequest) {
  try {
    const cohort: Cohort = await request.json();

    if (!cohort.id || !cohort.name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    const existing = await s3Storage.getCohort(cohort.id);
    if (existing) {
      return NextResponse.json(
        { error: "Cohort with this ID already exists" },
        { status: 409 }
      );
    }

    await s3Storage.saveCohort(cohort);

    return NextResponse.json({
      success: true,
      cohort,
      message: "Cohort created successfully",
    });
  } catch (error) {
    console.error("Error creating cohort:", error);
    return NextResponse.json(
      { error: "Failed to create cohort" },
      { status: 500 }
    );
  }
}
