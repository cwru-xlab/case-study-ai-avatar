import { NextResponse } from "next/server";
import { courseStorage, caseStorage } from "@/lib/case-storage";

// GET /api/cases - Get all cases across all courses
export async function GET() {
  try {
    const courses = await courseStorage.listCourses();
    
    const allCases: Array<{
      id: string;
      courseId: string;
      courseName: string;
      name: string;
      description: string;
      difficulty: string;
      status: string;
    }> = [];

    for (const course of courses) {
      const cases = await caseStorage.listCases(course.id);
      for (const c of cases) {
        allCases.push({
          id: c.id,
          courseId: course.id,
          courseName: course.name,
          name: c.name,
          description: c.description,
          difficulty: c.difficulty,
          status: c.status,
        });
      }
    }

    return NextResponse.json({
      success: true,
      cases: allCases,
    });
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 }
    );
  }
}
