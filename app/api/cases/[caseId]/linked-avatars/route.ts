import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

// GET /api/cases/[caseId]/linked-avatars - Get all avatars linked to a specific case
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    
    // Get courseId from query params
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId query parameter is required" },
        { status: 400 }
      );
    }

    // Get all avatars
    const allAvatars = await s3Storage.listAllAvatars();
    
    // Filter to find avatars linked to this case
    const linkedAvatars = allAvatars.filter(
      avatar => avatar.linkedCaseId === caseId && avatar.linkedCourseId === courseId
    ).map(avatar => ({
      id: avatar.id,
      name: avatar.name,
      description: avatar.description,
      published: avatar.published,
      lastEditedAt: avatar.lastEditedAt,
    }));

    return NextResponse.json({
      success: true,
      avatars: linkedAvatars,
      count: linkedAvatars.length,
    });
  } catch (error) {
    console.error("Error fetching linked avatars:", error);
    return NextResponse.json(
      { error: "Failed to fetch linked avatars" },
      { status: 500 }
    );
  }
}
