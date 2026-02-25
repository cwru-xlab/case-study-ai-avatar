/**
 * API Route: /api/courses
 * 
 * Handles course CRUD operations for the professor portal.
 * GET - List all courses
 * POST - Create a new course
 */

import { NextRequest, NextResponse } from "next/server";
import { courseStorage } from "@/lib/case-storage";

export async function GET() {
  try {
    const courses = await courseStorage.listCourses();
    return NextResponse.json({ courses });
  } catch (error) {
    console.error("Error listing courses:", error);
    return NextResponse.json(
      { error: "Failed to list courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { name, code, description, semester, professorId, professorName } = body;
    
    if (!name || !code || !semester || !professorId || !professorName) {
      return NextResponse.json(
        { error: "Missing required fields: name, code, semester, professorId, professorName" },
        { status: 400 }
      );
    }

    const course = await courseStorage.createCourse({
      name,
      code,
      description: description || "",
      semester,
      professorId,
      professorName,
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}
