import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

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

    const updatedCohort = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await s3Storage.saveCohort(updatedCohort);

    return NextResponse.json({
      success: true,
      cohort: updatedCohort,
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
