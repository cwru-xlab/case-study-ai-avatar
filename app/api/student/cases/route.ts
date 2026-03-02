import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Missing email parameter" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { email },
      include: {
        assignments: {
          include: {
            cohort: true,
          },
        },
        attempts: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const caseIds = [...new Set(student.assignments.map((a) => a.caseId))];

    const casesWithDetails = await Promise.all(
      caseIds.map(async (caseId) => {
        const caseStudy = await s3Storage.getCase(caseId);
        const assignment = student.assignments.find((a) => a.caseId === caseId);
        const caseAttempts = student.attempts.filter((a) => a.caseId === caseId);

        const scores = caseAttempts
          .map((a) => a.score)
          .filter((s): s is number => s !== null);

        let status: "not_started" | "in_progress" | "completed" = "not_started";
        if (caseAttempts.length > 0) {
          const hasPassingScore = scores.some((s) => s >= 70);
          status = hasPassingScore ? "completed" : "in_progress";
        }

        return {
          id: caseId,
          name: caseStudy?.name || "Unknown Case",
          backgroundInfo: caseStudy?.backgroundInfo || "",
          avatars: caseStudy?.avatars || [],
          cohortName: assignment?.cohort?.name || "",
          cohortCode: assignment?.cohort?.code || "",
          attemptCount: caseAttempts.length,
          bestScore: scores.length > 0 ? Math.max(...scores) : null,
          latestScore: scores.length > 0 ? scores[scores.length - 1] : null,
          status,
          assignedAt: assignment?.assignedAt.toISOString() || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.displayName || student.email.split("@")[0],
        email: student.email,
      },
      cases: casesWithDetails,
    });
  } catch (error) {
    console.error("Error fetching student cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch student cases" },
      { status: 500 }
    );
  }
}
