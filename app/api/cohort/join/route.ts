import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessCode, email, name } = body;

    if (!accessCode || !email) {
      return NextResponse.json(
        { error: "Access code and email are required" },
        { status: 400 }
      );
    }

    // Find cohort by access code
    const cohort = await s3Storage.getCohortByAccessCode(accessCode);

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    // Check if cohort is active
    if (!cohort.isActive) {
      return NextResponse.json(
        { error: "This cohort is no longer active" },
        { status: 400 }
      );
    }

    // Check if cohort is not yet available
    if (cohort.availableDate) {
      const now = new Date();
      const availDate = new Date(cohort.availableDate);
      if (now < availDate) {
        return NextResponse.json(
          { error: "This cohort is not yet available" },
          { status: 400 }
        );
      }
    }

    // Check if cohort has expired
    if (cohort.expirationDate) {
      const now = new Date();
      const expDate = new Date(cohort.expirationDate);
      if (now > expDate) {
        return NextResponse.json(
          { error: "This cohort has expired" },
          { status: 400 }
        );
      }
    }

    // Check access mode
    const normalizedEmail = email.trim().toLowerCase();

    if (cohort.accessMode === "specific") {
      // Check if email is in the allowed list
      const isAllowed = cohort.students?.some(
        (s) => s.email.toLowerCase() === normalizedEmail
      );

      if (!isAllowed) {
        return NextResponse.json(
          {
            error:
              "Your email is not authorized to join this cohort. Please contact your instructor.",
          },
          { status: 403 }
        );
      }
    }

    // Check if student already exists
    const existingStudent = cohort.students?.find(
      (s) => s.email.toLowerCase() === normalizedEmail
    );

    if (existingStudent) {
      // Update existing student status if they were invited
      if (existingStudent.status === "invited") {
        existingStudent.status = "joined";
        existingStudent.joinedAt = new Date().toISOString();
        if (name) existingStudent.name = name;
      }
    } else {
      // Add new student (only for "anyone" access mode)
      cohort.students = cohort.students || [];
      cohort.students.push({
        email: normalizedEmail,
        name: name || undefined,
        status: "joined",
        joinedAt: new Date().toISOString(),
      });
    }

    // Update cohort
    cohort.updatedAt = new Date().toISOString();
    await s3Storage.saveCohort(cohort);

    return NextResponse.json({
      success: true,
      message: "Successfully joined cohort",
      cohortName: cohort.name,
    });
  } catch (error) {
    console.error("Error joining cohort:", error);
    return NextResponse.json(
      { error: "Failed to join cohort" },
      { status: 500 }
    );
  }
}
