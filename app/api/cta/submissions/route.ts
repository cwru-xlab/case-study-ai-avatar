import { NextRequest, NextResponse } from "next/server";
import { ctaStorage } from "@/lib/cta-storage";

/**
 * GET /api/cta/submissions
 * 
 * Retrieve form submissions with filtering and pagination.
 * 
 * Query Parameters:
 * - limit: Number of submissions to return (default: 50, max: 100)
 * - offset: Number of submissions to skip for pagination
 * - avatarId: Filter by specific avatar ID
 * - status: Filter by submission status (pending, processed, failed)
 * - startDate: Filter submissions after this date (ISO string)
 * - endDate: Filter submissions before this date (ISO string)
 * - format: Response format ('json' or 'csv' for export)
 * 
 * Response:
 * {
 *   success: true,
 *   submissions: CTASubmission[],
 *   pagination: {
 *     total: number,
 *     limit: number,
 *     offset: number,
 *     hasMore: boolean
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const avatarId = searchParams.get("avatarId") || undefined;
    const status = searchParams.get("status") as "pending" | "processed" | "failed" | undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const format = searchParams.get("format") || "json";

    // Validate date parameters
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;
    
    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid start date format" },
          { status: 400 }
        );
      }
    }
    
    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid end date format" },
          { status: 400 }
        );
      }
    }

    // Fetch submissions with filters
    const result = await ctaStorage.listSubmissions({
      avatarId,
      status,
      startDate: startDateObj,
      endDate: endDateObj,
      limit,
      offset
    });

    // Handle CSV export format
    if (format === "csv") {
      const csvContent = generateCSV(result.submissions);
      
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cta-submissions-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Return JSON response
    return NextResponse.json({
      success: true,
      submissions: result.submissions,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("CTA submissions retrieval error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to load submissions" 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cta/submissions
 * 
 * Delete multiple submissions by ID.
 * 
 * Request Body:
 * {
 *   submissionIds: string[]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   deletedCount: number,
 *   errors: string[]
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { submissionIds }: { submissionIds: string[] } = await request.json();

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No submission IDs provided" },
        { status: 400 }
      );
    }

    if (submissionIds.length > 100) {
      return NextResponse.json(
        { success: false, error: "Cannot delete more than 100 submissions at once" },
        { status: 400 }
      );
    }

    // Delete submissions one by one and track results
    const results = await Promise.allSettled(
      submissionIds.map(id => ctaStorage.deleteSubmission(id))
    );

    const errors: string[] = [];
    let deletedCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        deletedCount++;
      } else {
        errors.push(`Failed to delete ${submissionIds[index]}: ${result.reason}`);
      }
    });

    // eslint-disable-next-line no-console
    console.log(`Bulk deletion completed: ${deletedCount} deleted, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      deletedCount,
      errors
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("CTA submissions deletion error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to delete submissions" 
      },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV Export
 * 
 * Convert submissions data to CSV format for download.
 */
function generateCSV(submissions: any[]): string {
  if (submissions.length === 0) {
    return "No submissions found";
  }

  const headers = [
    "Submission ID",
    "Name",
    "Email", 
    "Message",
    "Avatar Name",
    "Avatar ID",
    "Status",
    "Email Sent",
    "Session ID",
    "Message Count",
    "Chat Duration (ms)",
    "Submitted At",
    "Processed At",
    "IP Address",
    "User Agent"
  ];

  const rows = submissions.map(sub => [
    sub.submissionId,
    `"${sub.userDetails.name.replace(/"/g, '""')}"`,
    sub.userDetails.email,
    `"${(sub.userDetails.message || '').replace(/"/g, '""')}"`,
    `"${sub.metadata.avatarName.replace(/"/g, '""')}"`,
    sub.metadata.avatarId,
    sub.status,
    sub.emailSent ? "Yes" : "No",
    sub.sessionId,
    sub.metadata.messageCount,
    sub.metadata.chatDuration,
    sub.metadata.submittedAt,
    sub.processedAt || "",
    sub.metadata.ipAddress || "",
    `"${(sub.metadata.userAgent || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
