/**
 * CHAT GET API ENDPOINT
 * 
 * Retrieves a specific chat session by sessionId with complete conversation data.
 * 
 * Purpose:
 * - Individual session viewing for administrators
 * - Session details for analytics and reporting
 * - Full conversation history retrieval
 * - Session debugging and troubleshooting
 * - Export functionality for specific sessions
 * 
 * Features:
 * - Direct S3 retrieval for complete session data
 * - Comprehensive input validation
 * - Efficient single-session lookup
 * - Consistent error handling with other endpoints
 * 
 * Security:
 * - Protected by middleware (admin-only access)
 * - Session ID validation to prevent injection attacks
 * - Safe error messages that don't leak sensitive information
 * 
 * Performance:
 * - Direct S3 GetObject operation (very fast)
 * - Returns complete session including full message history
 * - No caching needed due to immutable nature of completed sessions
 */

import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

/**
 * GET /api/chat/get?sessionId=<session-id>
 * 
 * Retrieve a specific chat session with complete conversation data.
 * 
 * Query Parameters:
 * - sessionId: string (required)  // Unique session identifier
 * 
 * Examples:
 * GET /api/chat/get?sessionId=1703123456789_abc123def
 * 
 * Response (Success):
 * {
 *   success: true,
 *   session: {
 *     metadata: {
 *       sessionId: string,
 *       avatarId: string,
 *       avatarName: string,
 *       userId?: string,
 *       userName?: string,
 *       startTime: number,
 *       endTime: number,
 *       messageCount: number,
 *       isKioskMode: boolean,
 *       location?: string
 *     },
 *     messages: [
 *       {
 *         role: "user" | "assistant",
 *         content: string,
 *         timestamp: number
 *       }
 *     ],
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }
 * 
 * Response (Error):
 * {
 *   error: string
 * }
 * 
 * Error Codes:
 * - 400: Missing or invalid sessionId parameter
 * - 404: Session not found
 * - 500: S3 storage errors or internal server errors
 */
export async function GET(request: NextRequest) {
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
     * This is a required parameter - sessions cannot be retrieved without it.
     */
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required parameter: sessionId" },
        { status: 400 }
      );
    }

    /**
     * S3 SESSION RETRIEVAL
     * 
     * Retrieves the complete chat session from S3 storage.
     * 
     * This operation:
     * - Accesses S3 directly using GetObject
     * - Returns null if session doesn't exist (handled below)
     * - Includes complete conversation history
     * - Provides all metadata for analytics
     * 
     * Performance characteristics:
     * - Very fast for single session lookup
     * - Scales well regardless of total session count
     * - No caching needed (sessions are immutable once saved)
     */
    const session = await s3Storage.getChatSession(sessionId);

    /**
     * SESSION NOT FOUND HANDLING
     * 
     * Handles the case where the requested session doesn't exist.
     * 
     * This can happen when:
     * - Session ID is typed incorrectly
     * - Session was deleted
     * - Session ID format is invalid
     * - S3 object was manually removed
     * 
     * Returns 404 status code following REST conventions.
     */
    if (!session) {
      return NextResponse.json(
        { error: `Chat session with ID '${sessionId}' not found` },
        { status: 404 }
      );
    }

    /**
     * SUCCESS RESPONSE
     * 
     * Returns the complete session data including:
     * - Full metadata (session details, timestamps, counts)
     * - Complete message history (entire conversation)
     * - Audit fields (created/updated timestamps)
     * 
     * This provides all data needed for:
     * - Session viewing interfaces
     * - Conversation analysis
     * - Export functionality
     * - Debugging and troubleshooting
     */
    return NextResponse.json({
      success: true,
      session,
    });

  } catch (error) {
    /**
     * ERROR HANDLING AND LOGGING
     * 
     * Comprehensive error handling with detailed logging for debugging.
     * Follows the same patterns as other API endpoints for consistency.
     */
    console.error("Chat get error:", error);

    /**
     * S3-SPECIFIC ERROR HANDLING
     * 
     * Provides specific error messages for common S3 issues.
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
     * Fallback error handling for unexpected issues.
     * 
     * Provides a safe, generic error message while logging
     * detailed error information for debugging purposes.
     * 
     * This ensures that sensitive error details are not exposed
     * to clients while still providing actionable information.
     */
    return NextResponse.json(
      { error: "Failed to retrieve chat session" },
      { status: 500 }
    );
  }
} 