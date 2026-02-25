/**
 * API Route: /api/courses/[courseId]
 * 
 * Handles individual course operations.
 * GET - Get a single course
 * PUT - Update a course
 * DELETE - Delete a course
 */

import { NextRequest, NextResponse } from "next/server";
import { courseStorage, caseStorage } from "@/lib/case-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const course = await courseStorage.getCourse(courseId);
    
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Also get the cases for this course
    const cases = await caseStorage.listCases(courseId);

    return NextResponse.json({ course, cases });
  } catch (error) {
    console.error("Error getting course:", error);
    return NextResponse.json(
      { error: "Failed to get course" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();

    const course = await courseStorage.updateCourse(courseId, body);
    
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ course });
  } catch (error) {
    console.error("Error updating course:", error);
    return NextResponse.json(
      { error: "Failed to update course" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    
    const course = await courseStorage.getCourse(courseId);
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    await courseStorage.deleteCourse(courseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}
