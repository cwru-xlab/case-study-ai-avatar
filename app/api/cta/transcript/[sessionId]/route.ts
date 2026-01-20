import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { ChatSession } from "@/types";

/**
 * GET /api/cta/transcript/[sessionId]
 * 
 * Retrieve a chat transcript for public viewing.
 * 
 * Parameters:
 * - sessionId: The chat session ID from the URL path
 * 
 * Response:
 * {
 *   success: true,
 *   chatSession: ChatSession,
 *   metadata: {
 *     accessTime: string,
 *     sessionAge: number
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    /**
     * SESSION ID VALIDATION
     * 
     * Validate the session ID format to prevent injection attacks.
     */
    if (!sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Session ID is required" 
        },
        { status: 400 }
      );
    }

    const sessionIdRegex = /^[a-zA-Z0-9_-]+$/;

    if (!sessionIdRegex.test(sessionId) || sessionId.length > 100) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid session ID format" 
        },
        { status: 400 }
      );
    }

    /**
     * RATE LIMITING
     * 
     * Basic rate limiting to prevent abuse of the public endpoint.
     */
    const rateLimitCheck = await checkTranscriptRateLimit(request);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false,
          error: "Too many requests. Please try again later." 
        },
        { status: 429 }
      );
    }

    /**
     * FETCH CHAT SESSION
     * 
     * Retrieve the chat session from S3 storage.
     */
    const chatSession = await s3Storage.getChatSession(sessionId);
    
    if (!chatSession) {
      return NextResponse.json(
        { 
          success: false,
          error: "Chat session not found. The transcript may be expired or invalid." 
        },
        { status: 404 }
      );
    }

    const validationResult = validateSessionForPublicAccess(chatSession);

    if (!validationResult.valid) {
      return NextResponse.json(
        { 
          success: false,
          error: validationResult.reason 
        },
        { status: 403 }
      );
    }

    const now = Date.now();
    const sessionAge = now - chatSession.metadata.startTime; // Age in milliseconds
    
    const responseData = {
      success: true,
      chatSession: {
        ...chatSession,
        // Remove any sensitive metadata if needed
        metadata: {
          ...chatSession.metadata,
          // Keep userId/userName private for public access
          userId: undefined,
          userName: undefined
        }
      },
      metadata: {
        accessTime: new Date().toISOString(),
        sessionAge: sessionAge,
        sessionAgeFormatted: formatAge(sessionAge)
      }
    };

    const response = NextResponse.json(responseData);
    response.headers.set("Cache-Control", "public, max-age=3600, must-revalidate"); // 1 hour
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Transcript API error:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { 
            success: false,
            error: "Chat session not found" 
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to load chat transcript" 
      },
      { status: 500 }
    );
  }
}

//we can implement rate limiting here, placeholder for now
async function checkTranscriptRateLimit(request: NextRequest): Promise<{
  allowed: boolean;
  message: string;
}> {
  try {
    // Get client IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(',')[0] : "unknown";

    
    // For development, always allow requests
    if (process.env.NODE_ENV === "development") {
      return { allowed: true, message: "OK" };
    }

    return { allowed: true, message: "OK" };
    
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Rate limit check error:", error);
    // If rate limiting fails, allow the request
    return { allowed: true, message: "OK" };
  }
}

/**
 * Validate Session for Public Access
 * 
 * Ensures the session is appropriate for public viewing.
 */
function validateSessionForPublicAccess(chatSession: ChatSession): {
  valid: boolean;
  reason?: string;
} {
  // Check session age - don't allow access to very old sessions
  const now = Date.now();
  const sessionAge = now - chatSession.metadata.startTime;
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days, need to be configurable
  
  if (sessionAge > maxAge) {
    return {
      valid: false,
      reason:
        "This transcript has expired and is no longer available for viewing.",
    };
  }

  // Check if session has messages
  if (chatSession.messages.length === 0) {
    return {
      valid: false,
      reason: "This chat session contains no messages."
    };
  }


  return { valid: true };
}

/**
 * Format Age Duration
 * 
 * Convert milliseconds to a human-readable age format.
 */
function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return "Just now";
  }
}