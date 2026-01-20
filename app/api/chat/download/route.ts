/**
 * CHAT BATCH DOWNLOAD API - COMPRESSED ARCHIVE
 *
 * This endpoint provides batch downloading of multiple chat sessions:
 * - Download multiple sessions at once based on filters
 * - Automatically compresses data using GZIP for efficient transfer
 * - Returns a compressed archive containing all requested sessions
 * - Supports both individual session downloads and filtered batch exports
 *
 * Frontend Usage:
 * - POST request with array of session IDs in request body
 * - GET request with single sessionId query parameter (backward compatibility)
 */

import { NextRequest, NextResponse } from "next/server";
import { S3AvatarStorage } from "@/lib/s3-client";
import { gzip } from "zlib";
import { promisify } from "util";

const chatStorage = new S3AvatarStorage();
const gzipAsync = promisify(gzip);

/**
 * GET /api/chat/download?sessionId=xxx
 *
 * Download a single chat session (backward compatibility)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Download single session
    return await downloadSessions([sessionId], `chat-session-${sessionId}`);
  } catch (error) {
    console.error("Error downloading single chat session:", error);
    return NextResponse.json(
      { error: "Failed to download chat session" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/download
 *
 * Download multiple chat sessions as compressed archive
 * Body: { sessionIds: string[], filename?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds, filename } = body;

    // Validate input
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { error: "sessionIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (sessionIds.length > 1000) {
      return NextResponse.json(
        { error: "Maximum 1000 sessions allowed per download" },
        { status: 400 }
      );
    }

    // Generate filename
    const downloadFilename = filename || `chat-sessions-${Date.now()}`;

    // Download multiple sessions
    return await downloadSessions(sessionIds, downloadFilename);
  } catch (error) {
    console.error("Error downloading chat sessions:", error);
    return NextResponse.json(
      { error: "Failed to download chat sessions" },
      { status: 500 }
    );
  }
}

/**
 * Core function to download and compress chat sessions
 */
async function downloadSessions(
  sessionIds: string[],
  baseFilename: string
): Promise<NextResponse> {
  const sessions: any[] = [];
  const errors: string[] = [];

  // Fetch all sessions
  for (const sessionId of sessionIds) {
    try {
      const session = await chatStorage.getChatSession(sessionId);
      if (session) {
        sessions.push(session);
      } else {
        errors.push(`Session not found: ${sessionId}`);
      }
    } catch (error) {
      console.error(`Error fetching session ${sessionId}:`, error);
      errors.push(
        `Error fetching session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Check if we got any sessions
  if (sessions.length === 0) {
    return NextResponse.json(
      {
        error: "No valid sessions found",
        details: errors,
      },
      { status: 404 }
    );
  }

  // Create download package
  const downloadData = {
    metadata: {
      downloadedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      requestedSessions: sessionIds.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    sessions: sessions,
  };

  // Convert to JSON
  const jsonContent = JSON.stringify(downloadData, null, 2);

  // Compress the data
  const compressedData = await gzipAsync(Buffer.from(jsonContent, "utf8"));

  // Determine filename and content type
  const filename = `${baseFilename}.json.gz`;

  return new NextResponse(compressedData, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": compressedData.length.toString(),
      "Cache-Control": "no-cache",
      "X-Total-Sessions": sessions.length.toString(),
      "X-Requested-Sessions": sessionIds.length.toString(),
      "X-Errors": errors.length.toString(),
    },
  });
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
