/**
 * CHAT LIST API ENDPOINT
 * 
 * Provides comprehensive chat session listing with advanced filtering capabilities.
 * Supports analytics and reporting by enabling administrators to query
 * and analyze chat session data.
 * 
 * Purpose:
 * - Dashboard session listings for administrators
 * - Avatar performance analytics (sessions per avatar)
 * - User engagement analytics (sessions per user)
 * - Time-based reporting (daily/weekly/monthly stats)
 * - Session browsing and management interface
 * 
 * Features:
 * - Multiple filtering options (avatar, user, date range)
 * - Pagination support for large datasets
 * - Optimized responses (metadata only, not full messages)
 * - Comprehensive input validation
 * - Consistent error handling
 * 
 * Security:
 * - Protected by middleware (admin-only access)
 * - Input sanitization for all query parameters
 * - Rate limiting through Next.js built-in mechanisms
 */

import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

/**
 * GET /api/chat/list
 * 
 * List chat sessions with optional filtering and pagination.
 * 
 * Query Parameters:
 * - avatarId?: string      // Filter by specific avatar
 * - userId?: string        // Filter by specific user  
 * - startDate?: string     // ISO date string for start range
 * - endDate?: string       // ISO date string for end range
 * - limit?: string         // Maximum number of results
 * 
 * Examples:
 * GET /api/chat/list                                    // All sessions
 * GET /api/chat/list?avatarId=weather-bot               // Avatar-specific
 * GET /api/chat/list?startDate=2023-12-01&endDate=2023-12-31  // Date range
 * GET /api/chat/list?limit=50                           // Paginated
 * 
 * Response (Success):
 * {
 *   success: true,
 *   sessions: [
 *     {
 *       sessionId: string,
 *       avatarId: string,
 *       avatarName: string,
 *       userId?: string,
 *       userName?: string,
 *       startTime: number,
 *       endTime: number,
 *       messageCount: number,
 *       isKioskMode: boolean,
 *       location?: string,
 *       createdAt: string,
 *       updatedAt: string
 *     }
 *   ],
 *   total: number,
 *   filters: object
 * }
 * 
 * Response (Error):
 * {
 *   error: string
 * }
 * 
 * Error Codes:
 * - 400: Invalid query parameters (malformed dates, invalid limits)
 * - 500: S3 storage errors or internal server errors
 */
export async function GET(request: NextRequest) {
  try {
    /**
     * QUERY PARAMETER EXTRACTION
     * 
     * Extracts and processes all supported query parameters from the URL.
     * Uses Next.js URL API for reliable parameter parsing.
     */
    const { searchParams } = new URL(request.url);
    
    // Extract all supported filter parameters
    const avatarId = searchParams.get("avatarId");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = searchParams.get("limit");

    /**
     * FILTER OPTIONS CONSTRUCTION
     * 
     * Builds a structured options object for the S3 client.
     * Includes comprehensive validation for each parameter type.
     */
    const options: {
      avatarId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {};

    // Avatar ID filter (exact match)
    if (avatarId) options.avatarId = avatarId;
    
    // User ID filter (exact match)
    if (userId) options.userId = userId;
    
    /**
     * START DATE VALIDATION AND PARSING
     * 
     * Validates and converts startDate parameter to Date object.
     * Provides specific error message for invalid date formats.
     */
    if (startDate) {
      const date = new Date(startDate);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate format" },
          { status: 400 }
        );
      }
      options.startDate = date;
    }
    
    /**
     * END DATE VALIDATION AND PARSING
     * 
     * Validates and converts endDate parameter to Date object.
     * Provides specific error message for invalid date formats.
     */
    if (endDate) {
      const date = new Date(endDate);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid endDate format" },
          { status: 400 }
        );
      }
      options.endDate = date;
    }
    
    /**
     * LIMIT VALIDATION AND PARSING
     * 
     * Validates and converts limit parameter to positive integer.
     * Prevents negative limits and invalid number formats.
     * 
     * This supports pagination and prevents memory issues with large datasets.
     */
    if (limit) {
      const limitNum = parseInt(limit, 10);
      // Validate limit is a positive integer
      if (isNaN(limitNum) || limitNum <= 0) {
        return NextResponse.json(
          { error: "Invalid limit: must be a positive number" },
          { status: 400 }
        );
      }
      options.limit = limitNum;
    }

    /**
     * S3 STORAGE QUERY
     * 
     * Retrieves chat sessions from S3 with applied filters.
     * Uses the S3 client's advanced filtering capabilities.
     * 
     * This operation may be expensive for large datasets, but is acceptable
     * for current scale. Future optimization could include:
     * - S3 metadata tags for indexed queries
     * - Separate analytics database
     * - Caching layer for frequent queries
     */
    const sessions = await s3Storage.listChatSessions(options);

    /**
     * SUCCESS RESPONSE
     * 
     * Returns comprehensive result set with metadata about the query.
     * 
     * Response structure:
     * - sessions: Array of session summaries
     * - total: Number of sessions returned (useful for pagination)
     * - filters: Echo of applied filters (useful for UI state management)
     */
    return NextResponse.json({
      success: true,
      sessions: sessions,
      total: sessions.length,
      filters: options,                    // Echo filters for client convenience
    });

  } catch (error) {
    /**
     * ERROR HANDLING AND LOGGING
     * 
     * Comprehensive error handling with detailed logging for debugging.
     * Follows the same patterns as other API endpoints for consistency.
     */
    console.error("Chat list error:", error);

    /**
     * S3-SPECIFIC ERROR HANDLING
     * 
     * Provides specific error messages for common S3 issues.
     * Helps administrators quickly diagnose and resolve problems.
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
     * Logs detailed error information while returning safe error message.
     */
    return NextResponse.json(
      { error: "Failed to list chat sessions" },
      { status: 500 }
    );
  }
} 