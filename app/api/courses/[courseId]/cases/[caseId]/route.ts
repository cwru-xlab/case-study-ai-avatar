/**
 * API Route: /api/courses/[courseId]/cases/[caseId]
 * 
 * Handles individual case operations.
 * GET - Get a single case
 * PUT - Update a case (full update)
 * PATCH - Partial update (for auto-save)
 * DELETE - Delete a case (also unlinks any avatars referencing this case)
 */

import { NextRequest, NextResponse } from "next/server";
import { caseStorage, courseStorage } from "@/lib/case-storage";
import { s3Storage } from "@/lib/s3-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; caseId: string }> }
) {
  try {
    const { courseId, caseId } = await params;
    
    const caseData = await caseStorage.getCase(courseId, caseId);
    
    if (!caseData) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ case: caseData });
  } catch (error) {
    console.error("Error getting case:", error);
    return NextResponse.json(
      { error: "Failed to get case" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; caseId: string }> }
) {
  try {
    const { courseId, caseId } = await params;
    const body = await request.json();

    const updated = await caseStorage.updateCase(courseId, caseId, body);
    
    if (!updated) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ case: updated });
  } catch (error) {
    console.error("Error updating case:", error);
    return NextResponse.json(
      { error: "Failed to update case" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; caseId: string }> }
) {
  try {
    const { courseId, caseId } = await params;
    const body = await request.json();

    const updated = await caseStorage.updateCase(courseId, caseId, body);
    
    if (!updated) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ case: updated, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error patching case:", error);
    return NextResponse.json(
      { error: "Failed to update case" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; caseId: string }> }
) {
  try {
    const { courseId, caseId } = await params;
    
    const caseData = await caseStorage.getCase(courseId, caseId);
    if (!caseData) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Cascade unlink: Find all avatars linked to this case and unlink them
    try {
      const allAvatars = await s3Storage.listAllAvatars();
      const linkedAvatars = allAvatars.filter(
        avatar => avatar.linkedCaseId === caseId && avatar.linkedCourseId === courseId
      );
      
      // Unlink each avatar
      for (const avatar of linkedAvatars) {
        await s3Storage.saveAvatar({
          ...avatar,
          linkedCaseId: undefined,
          linkedCourseId: undefined,
          lastEditedAt: new Date().toISOString(),
        });
        console.log(`Unlinked avatar "${avatar.name}" (${avatar.id}) from deleted case ${caseId}`);
      }
      
      if (linkedAvatars.length > 0) {
        console.log(`Cascade unlink: ${linkedAvatars.length} avatar(s) unlinked from case ${caseId}`);
      }
    } catch (unlinkError) {
      console.error("Error during cascade unlink:", unlinkError);
      // Continue with deletion even if unlink fails
    }

    await caseStorage.deleteCase(courseId, caseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting case:", error);
    return NextResponse.json(
      { error: "Failed to delete case" },
      { status: 500 }
    );
  }
}
