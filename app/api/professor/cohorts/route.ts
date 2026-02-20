import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Cohort } from "@/types/cohort";

// GET /api/professor/cohorts - List all cohorts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const professorId = searchParams.get("professorId");

    const cohorts = await s3Storage.listCohorts(professorId || undefined);

    return NextResponse.json(cohorts);
  } catch (error) {
    console.error("Error listing cohorts:", error);
    return NextResponse.json(
      { error: "Failed to list cohorts" },
      { status: 500 }
    );
  }
}

// POST /api/professor/cohorts - Create a new cohort
export async function POST(request: NextRequest) {
  try {
    const cohort: Cohort = await request.json();

    if (!cohort.id || !cohort.name || !cohort.professorId) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, professorId" },
        { status: 400 }
      );
    }

    // Check if cohort already exists
    const existing = await s3Storage.getCohort(cohort.id);
    if (existing) {
      return NextResponse.json(
        { error: "Cohort with this ID already exists" },
        { status: 409 }
      );
    }

    const version = await s3Storage.saveCohort(cohort);

    return NextResponse.json({
      success: true,
      cohort,
      version,
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
