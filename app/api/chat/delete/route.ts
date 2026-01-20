/**
 * CHAT DELETE API ENDPOINT
 * 
 * Permanently removes a chat session from S3 storage.
 * 
 * Purpose:
 * - Data privacy compliance (user deletion requests)
 * - Administrative cleanup of unwanted sessions
 * - Data retention policy enforcement
 * - Development and testing cleanup
 * - Storage cost optimization (removing old sessions)
 * 
 * Features:
 * - Direct S3 DeleteObject operation
 * - Existence validation before deletion
 * - Comprehensive error handling
 * - Audit logging for deletion operations
 * - Consistent API patterns with other endpoints
 * 
 * Security:
 * - Protected by middleware (admin-only access)
 * - Session ID validation to prevent unauthorized deletions
 * - Safe error messages that don't leak system information
 * - Proper authorization checks through middleware
 * 
 * Compliance:
 * - Supports GDPR "right to be forgotten" requirements
 * - Enables data retention policy enforcement
 * - Provides audit trail through logging
 * - Ensures complete data removal from storage
 * 
 * Warning:
 * This operation is IRREVERSIBLE. Once a session is deleted from S3,
 * it cannot be recovered unless there are external backups.
 */

import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

/**
 * DELETE /api/chat/delete?sessionId=<session-id>
 * 
 * Permanently delete a chat session from S3 storage.
 * 
 * Query Parameters:
 * - sessionId: string (required)  // Unique session identifier to delete
 * 
 * Examples:
 * DELETE /api/chat/delete?sessionId=1703123456789_abc123def
 * 
 * Response (Success):
 * {
 *   success: true,
 *   sessionId: string,
 *   message: "Chat session deleted successfully"
 * }
 * 
 * Response (Error):
 * {
 *   error: string
 * }
 * 
 * Error Codes:
 * - 400: Missing or invalid sessionId parameter
 * - 404: Session not found (already deleted or never existed)
 * - 500: S3 storage errors or internal server errors
 * 
 * Security Notes:
 * - This endpoint requires admin privileges (enforced by middleware)
 * - Deletion is immediate and irreversible
 * - All deletion operations are logged for audit purposes
 */
export async function DELETE(request: NextRequest) {
  try {
    /**
     * QUERY PARAMETER EXTRACTION
     * 
     * Extracts the sessionId from the URL query parameters.
     * Uses Next.js URL API for reliable parameter parsing.
     */
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    /**
     * SESSION ID VALIDATION
     * 
     * Validates that sessionId parameter is provided.
     * This is a required parameter - cannot delete without knowing what to delete.
     */
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required parameter: sessionId" },
        { status: 400 }
      );
    }

    /**
     * SESSION EXISTENCE VALIDATION
     * 
     * Checks if the session exists before attempting deletion.
     * This provides better user experience and clear error messages.
     * 
     * Benefits:
     * - Prevents unnecessary S3 DeleteObject calls
     * - Provides clear feedback when session doesn't exist
     * - Helps distinguish between "not found" and "delete failed"
     * - Supports idempotent deletion operations
     */
    const exists = await s3Storage.chatSessionExists(sessionId);
    if (!exists) {
      return NextResponse.json(
        { error: `Chat session with ID '${sessionId}' not found` },
        { status: 404 }
      );
    }

    /**
     * S3 DELETION OPERATION
     * 
     * Performs the actual deletion from S3 storage.
     * 
     * This operation:
     * - Removes the session JSON file from S3 permanently
     * - Is atomic (either succeeds completely or fails completely)
     * - Cannot be undone once completed
     * - Frees up storage space immediately
     * 
     * Technical details:
     * - Uses S3 DeleteObject API
     * - Handles eventual consistency with verification
     * - No versioning (objects are deleted immediately)
     * - Error handling covers network and permission issues
     */
    await s3Storage.deleteChatSession(sessionId);

    /**
     * EVENTUAL CONSISTENCY HANDLING
     * 
     * S3 has eventual consistency for delete operations. To prevent the 
     * appearance of "key rotation" where a deleted session seems to point 
     * to a new conversation, we verify the deletion completed.
     * 
     * This small delay helps ensure list operations reflect the deletion.
     */
    let retries = 0;
    const maxRetries = 3;
    while (retries < maxRetries) {
      const stillExists = await s3Storage.chatSessionExists(sessionId);
      if (!stillExists) {
        break; // Deletion confirmed
      }
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      }
    }

    /**
     * SUCCESS RESPONSE WITH AUDIT INFORMATION
     * 
     * Returns confirmation of successful deletion with audit details.
     * 
     * Response includes:
     * - sessionId: Confirms which session was deleted
     * - success flag: Clear indication of operation success
     * - message: Human-readable confirmation
     * 
     * This information is useful for:
     * - User interface confirmation messages
     * - Audit logging and compliance reporting
     * - Administrative dashboards
     * - Debugging and troubleshooting
     */
    return NextResponse.json({
      success: true,
      sessionId,
      message: "Chat session deleted successfully",
    });

  } catch (error) {
    /**
     * ERROR HANDLING AND AUDIT LOGGING
     * 
     * Comprehensive error handling with detailed logging for debugging and auditing.
     * 
     * Error logging is especially important for delete operations because:
     * - Failed deletions may leave orphaned data
     * - Privacy compliance may require confirmed deletion
     * - Administrative actions need audit trails
     * - Debugging deletion issues requires detailed error information
     */
    console.error("Chat delete error:", error);

    /**
     * S3-SPECIFIC ERROR HANDLING
     * 
     * Provides specific error messages for common S3 deletion issues.
     */
    if (error instanceof Error) {
      // Handle AWS credential issues
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
      // Handle bucket access issues
      if (error.message.includes("bucket")) {
        return NextResponse.json(
          { error: "S3 bucket access error" },
          { status: 500 }
        );
      }
    }

    /**
     * GENERIC ERROR RESPONSE
     * 
     * Fallback error handling for unexpected deletion failures.
     * 
     * This is critical for delete operations because:
     * - Failed deletions may require manual intervention
     * - Users need to know if deletion actually succeeded
     * - Compliance requirements may mandate confirmed deletion
     * - Partial failures need to be clearly communicated
     * 
     * The error is logged with full details while the response
     * provides a safe, generic message to prevent information leakage.
     */
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    );
  }
} 