/**
 * API Route: /api/courses/[courseId]/cases
 * 
 * Handles case operations within a course.
 * GET - List all cases in a course
 * POST - Create a new case
 */

import { NextRequest, NextResponse } from "next/server";
import { caseStorage, courseStorage } from "@/lib/case-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    
    // Verify course exists
    const course = await courseStorage.getCourse(courseId);
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    const cases = await caseStorage.listCases(courseId);
    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Error listing cases:", error);
    return NextResponse.json(
      { error: "Failed to list cases" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    
    // Verify course exists
    const course = await courseStorage.getCourse(courseId);
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    const { name, description, difficulty, estimatedDuration, createdBy, createdByName, avatarId } = body;
    
    if (!name || !description || !difficulty || !estimatedDuration || !createdBy || !createdByName || !avatarId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const newCase = await caseStorage.createCase(courseId, {
      name,
      description,
      difficulty,
      estimatedDuration,
      createdBy,
      createdByName,
      avatarId,
    });

    return NextResponse.json({ case: newCase }, { status: 201 });
  } catch (error) {
    console.error("Error creating case:", error);
    return NextResponse.json(
      { error: "Failed to create case" },
      { status: 500 }
    );
  }
}
