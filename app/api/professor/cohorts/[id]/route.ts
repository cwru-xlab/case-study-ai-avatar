import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

// GET /api/professor/cohorts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing cohort ID" },
        { status: 400 }
      );
    }

    const cohort = await s3Storage.getCohort(id);

    if (!cohort) {
      return NextResponse.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(cohort);
  } catch (error) {
    console.error("Error fetching cohort:", error);
    return NextResponse.json(
      { error: "Failed to fetch cohort" },
      { status: 500 }
    );
  }
}

// PUT /api/professor/cohorts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { cohort, expectedVersion } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Missing cohort ID" },
        { status: 400 }
      );
    }

    const existing = await s3Storage.getCohort(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    // Version conflict check
    if (expectedVersion && existing.version > expectedVersion) {
      return NextResponse.json(
        {
          error: "Version conflict: Cohort was modified by another user",
          currentVersion: existing.version,
          expectedVersion,
        },
        { status: 409 }
      );
    }

    const updatedCohort = {
      ...existing,
      ...cohort,
      id,
      updatedAt: new Date().toISOString(),
    };

    const version = await s3Storage.saveCohort(updatedCohort);

    return NextResponse.json({
      success: true,
      cohort: updatedCohort,
      version,
      message: "Cohort updated successfully",
    });
  } catch (error) {
    console.error("Error updating cohort:", error);
    return NextResponse.json(
      { error: "Failed to update cohort" },
      { status: 500 }
    );
  }
}

// DELETE /api/professor/cohorts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing cohort ID" },
        { status: 400 }
      );
    }

    await s3Storage.deleteCohort(id);

    return NextResponse.json({
      success: true,
      message: "Cohort deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting cohort:", error);
    return NextResponse.json(
      { error: "Failed to delete cohort" },
      { status: 500 }
    );
  }
}
