import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

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
