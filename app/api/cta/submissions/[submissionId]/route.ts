
import { NextRequest, NextResponse } from "next/server";
import { ctaStorage } from "@/lib/cta-storage";

/**
 * GET /api/cta/submissions/[submissionId]
 * 
 * Retrieve detailed information for a specific submission.
 * 
 * Parameters:
 * - submissionId: The submission ID from the URL path
 * 
 * Response:
 * {
 *   success: true,
 *   submission: CTASubmission
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;

    /**
     * SUBMISSION ID VALIDATION
     * 
     * Validate the submission ID format to prevent injection attacks.
     */
    if (!submissionId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Submission ID is required" 
        },
        { status: 400 }
      );
    }

    const submissionIdRegex = /^cta_[0-9]+_[a-zA-Z0-9]+$/;

    if (!submissionIdRegex.test(submissionId) || submissionId.length > 100) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid submission ID format" 
        },
        { status: 400 }
      );
    }

    /**
     * FETCH SUBMISSION
     * 
     * Retrieve the submission from storage.
     */
    const submission = await ctaStorage.getSubmission(submissionId);
    
    if (!submission) {
      return NextResponse.json(
        { 
          success: false,
          error: "Submission not found" 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      submission
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Individual submission retrieval error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to load submission" 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cta/submissions/[submissionId]
 * 
 * Delete a specific submission.
 * 
 * Parameters:
 * - submissionId: The submission ID from the URL path
 * 
 * Response:
 * {
 *   success: true,
 *   message: string
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;

    /**
     * SUBMISSION ID VALIDATION
     */
    if (!submissionId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Submission ID is required" 
        },
        { status: 400 }
      );
    }

    const submissionIdRegex = /^cta_[0-9]+_[a-zA-Z0-9]+$/;

    if (!submissionIdRegex.test(submissionId) || submissionId.length > 100) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid submission ID format" 
        },
        { status: 400 }
      );
    }

    /**
     * CHECK SUBMISSION EXISTS
     * 
     * Verify the submission exists before attempting deletion.
     */
    const existingSubmission = await ctaStorage.getSubmission(submissionId);
    
    if (!existingSubmission) {
      return NextResponse.json(
        { 
          success: false,
          error: "Submission not found" 
        },
        { status: 404 }
      );
    }

    await ctaStorage.deleteSubmission(submissionId);

    // eslint-disable-next-line no-console
    console.log(`Deleted CTA submission: ${submissionId}`);

    return NextResponse.json({
      success: true,
      message: "Submission deleted successfully"
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Individual submission deletion error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to delete submission" 
      },
      { status: 500 }
    );
  }
}