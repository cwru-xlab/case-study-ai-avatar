import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { headers } from "next/headers";
import { ctaStorage } from "@/lib/cta-storage";
import { s3Storage } from "@/lib/s3-client";
import type { CTAFormData } from "@/types";

/**
 * POST /api/cta/submit
 * 
 * Submit a CTA form with user contact information.
 * 
 * Request Body:
 * {
 *   sessionId: string,        // Chat session ID from QR code
 *   name: string,             // User's full name
 *   email: string,            // User's email address
 *   message: string           // Optional user message (max 500 chars)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   submissionId: string,     // Unique submission identifier
 *   message: string           // Success message
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get request headers for metadata
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    // Parse and validate request body
    const data: CTAFormData = await request.json();
    

    const validationErrors = validateFormData(data);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: validationErrors.join("; ") 
        },
        { status: 400 }
      );
    }

    /**
     * CTA FEATURE CHECK
     * 
     * Verify that the CTA feature is enabled before processing submissions.
     */
    const config = await ctaStorage.getConfig();

    if (!config.enabled) {
      return NextResponse.json(
        { 
          success: false,
          error: "Form submissions are currently disabled" 
        },
        { status: 503 }
      );
    }

    /**
     * CHAT SESSION VALIDATION
     * 
     * Verify that the chat session from the QR code is valid.
     * This uses our enhanced validation that checks both S3 and active sessions.
     */
    
    let sessionValidationData;
    
    // Check if QR code data is included in the request body
    const hasQrCodeData = data.qrCodeData !== undefined && data.qrCodeData !== null;
    const hasAvatarId = !!(data.qrCodeData && data.qrCodeData.avatarId && data.qrCodeData.avatarId !== "");
    const hasTimestamp = !!(data.qrCodeData && data.qrCodeData.timestamp && data.qrCodeData.timestamp > 0);
    
    if (hasQrCodeData && hasAvatarId && hasTimestamp) {
      const { sessionId, qrCodeData } = data;
      const { avatarId, avatarName, timestamp } = qrCodeData!;

      // Basic format validation
      const sessionIdRegex = /^[0-9]+_[a-zA-Z0-9]+$/;

      if (!sessionIdRegex.test(sessionId)) {
        return NextResponse.json(
          { 
            success: false,
            error: "Invalid session ID format" 
          },
          { status: 400 }
        );
      }

      // Timestamp validation
      const now = Date.now();
      const qrCodeAge = now - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (qrCodeAge > maxAge) {
        return NextResponse.json(
          { 
            success: false,
            error: "QR code has expired" 
          },
          { status: 400 }
        );
      }

      // Check S3 for saved session first
      let savedSession = null;

      try {
        savedSession = await s3Storage.getChatSession(sessionId);
      } catch (error) {
        // Expected for active sessions - not an error
      }

      if (savedSession) {
        sessionValidationData = {
          sessionId: savedSession.metadata.sessionId,
          avatarId: savedSession.metadata.avatarId,
          avatarName: savedSession.metadata.avatarName,
          messageCount: savedSession.messages?.length || 0,
          isActive: false
        };
      } else {
        // For active sessions, we'll trust the QR code data if it passes basic validation
        sessionValidationData = {
          sessionId,
          avatarId,
          avatarName,
          messageCount: 0, // Unknown for active sessions
          isActive: true,
        };
      }
    } else {
      // Fallback: Basic session validation for backward compatibility
      const chatSession = await s3Storage.getChatSession(data.sessionId);

      if (!chatSession) {
        return NextResponse.json(
          { 
            success: false,
            error: "Chat session not found. The QR code may be expired." 
          },
          { status: 404 }
        );
      }
      sessionValidationData = {
        sessionId: chatSession.metadata.sessionId,
        avatarId: chatSession.metadata.avatarId,
        avatarName: chatSession.metadata.avatarName,
        messageCount: chatSession.messages?.length || 0,
        isActive: false
      };
    }

    /**
     * RATE LIMITING CHECK
     * 
     * Basic rate limiting to prevent spam submissions.
     * Check for recent submissions from the same IP or email.
     */
    const rateLimitCheck = await checkRateLimit(data.email, ipAddress);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false,
          error: rateLimitCheck.message 
        },
        { status: 429 }
      );
    }

    /**
     * SAVE FORM SUBMISSION
     * 
     * Store the submission data in S3 with complete metadata.
     */
    const submission = await ctaStorage.saveSubmissionWithSessionData(data, {
      ipAddress,
      userAgent: userAgent.substring(0, 500) 
    }, sessionValidationData);

    
    waitUntil(processSubmissionAsyncWithSessionData(submission.submissionId, sessionValidationData).catch(error => {
      // eslint-disable-next-line no-console
      console.error("Async submission processing failed:", error);
    }));

    return NextResponse.json({
      success: true,
      submissionId: submission.submissionId,
      message: "Thank you! We'll be in touch soon. Check your email for confirmation.",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("CTA form submission error:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("Chat session")) {
        return NextResponse.json(
          { 
            success: false,
            error: "Chat session not found. The QR code may be expired." 
          },
          { status: 404 }
        );
      }
      
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { 
            success: false,
            error: "Too many submissions. Please try again later." 
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to submit form. Please try again." 
      },
      { status: 500 }
    );
  }
}


function validateFormData(data: CTAFormData): string[] {
  const errors: string[] = [];

  // Session ID validation
  if (!data.sessionId) {
    errors.push("Session ID is required");
  } else if (typeof data.sessionId !== "string") {
    errors.push("Session ID must be a string");
  } else if (!/^[a-zA-Z0-9_-]+$/.test(data.sessionId)) {
    errors.push("Invalid session ID format");
  } else if (data.sessionId.length > 100) {
    errors.push("Session ID too long");
  }

  // Name validation
  if (!data.name) {
    errors.push("Name is required");
  } else if (typeof data.name !== "string") {
    errors.push("Name must be a string");
  } else if (data.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  } else if (data.name.trim().length > 100) {
    errors.push("Name must be less than 100 characters");
  }

  // Email validation
  if (!data.email) {
    errors.push("Email is required");
  } else if (typeof data.email !== "string") {
    errors.push("Email must be a string");
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(data.email.trim())) {
      errors.push("Invalid email format");
    } else if (data.email.trim().length > 255) {
      errors.push("Email too long");
    }
  }

  // Message validation (optional)
  if (data.message) {
    if (typeof data.message !== "string") {
      errors.push("Message must be a string");
    } else if (data.message.length > 500) {
      errors.push("Message must be less than 500 characters");
    }
  }

  return errors;
}

/**
 * Rate Limiting Check
 * 
 * Simple rate limiting to prevent spam submissions.
 */
async function checkRateLimit(email: string, ipAddress: string): Promise<{
  allowed: boolean;
  message: string;
}> {
  try {
    const recentSubmissions = await ctaStorage.listSubmissions({
      limit: 100
    });

    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes
    const oneHourAgo = now - (60 * 60 * 1000); // 1 hour

    // Check for submissions from same email in last 5 minutes
    const recentEmailSubmissions = recentSubmissions.submissions.filter(sub => 
      sub.userDetails.email === email &&
        new Date(sub.createdAt).getTime() > fiveMinutesAgo,
    );

    if (recentEmailSubmissions.length > 0) {
      return {
        allowed: false,
        message: "Please wait a few minutes before submitting again"
      };
    }

    // Check for excessive submissions from same IP in last hour
    const recentIPSubmissions = recentSubmissions.submissions.filter(sub => 
      sub.metadata.ipAddress === ipAddress &&
        new Date(sub.createdAt).getTime() > oneHourAgo,
    );

    if (recentIPSubmissions.length >= 10) {
      return {
        allowed: false,
        message: "Too many submissions from this location. Please try again later."
      };
    }

    return { allowed: true, message: "OK" };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Rate limit check error:", error);

    // If rate limiting fails, allow the submission
    return { allowed: true, message: "OK" };
  }
}

/**
 * Async Submission Processing with Session Data
 * 
 * Works with both active and saved sessions.
 * Processes the submission in the background after the user receives
 * their success response. This includes sending emails and updating status.
 */
async function processSubmissionAsyncWithSessionData(
  submissionId: string, 
  sessionData: {
    sessionId: string;
    avatarId: string;
    avatarName: string;
    messageCount: number;
    isActive: boolean;
  }
): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log(`Starting async processing for submission: ${submissionId} (${sessionData.isActive ? 'active' : 'saved'} session)`);
    
    // Process the submission with session data (send emails, update status)
    await ctaStorage.processSubmissionWithSessionData(submissionId, sessionData);
    
    // eslint-disable-next-line no-console
    console.log(`Successfully processed submission: ${submissionId}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to process submission ${submissionId}:`, error);

  }
}
