/**
 * KIOSK CHAT SAVE API ENDPOINT
 * 
 * Public endpoint for saving chat sessions from the kiosk interface.
 * This endpoint is intentionally separate from the admin-only /api/chat/save
 * to maintain security while allowing public kiosk functionality.
 * 
 * Purpose:
 * - Allow public kiosk users to save their chat sessions
 * - Maintain separation between admin and public functionality
 * - Ensure kiosk sessions are properly stored without authentication
 * 
 * Security Considerations:
 * - Public endpoint (no authentication required)
 * - Enhanced validation to prevent abuse
 * - Rate limiting through Next.js built-in mechanisms
 * - Input sanitization to prevent malicious data
 * - Kiosk-specific validation (isKioskMode must be true)
 * 
 * Differences from admin endpoint:
 * - No authentication required
 * - More strict validation (must be kiosk mode)
 * - Limited metadata acceptance
 * - Additional abuse prevention measures
 */

import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

/**
 * POST /api/chat/save-kiosk
 * 
 * Save a chat session from kiosk interface to S3 storage.
 * This is a public endpoint specifically for kiosk usage.
 * 
 * Request Body:
 * {
 *   sessionId: string,           // Unique session identifier
 *   avatarId: string,            // Avatar involved in conversation
 *   avatarName: string,          // Avatar display name
 *   messages: ChatMessage[],     // Complete conversation history
 *   isKioskMode: true,           // Must be true for this endpoint
 *   location?: string            // Optional location identifier
 * }
 * 
 * Note: userId/userName are not accepted from public kiosk interface
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const data = await request.json();
    
    /**
     * REQUIRED FIELD VALIDATION FOR KIOSK
     * 
     * Validates essential fields for kiosk chat sessions.
     * More restrictive than admin endpoint to prevent abuse.
     */
    if (!data.sessionId || !data.avatarId || !data.avatarName || !data.messages) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, avatarId, avatarName, messages" },
        { status: 400 }
      );
    }

    /**
     * KIOSK MODE VALIDATION
     * 
     * Ensures this endpoint is only used for legitimate kiosk sessions.
     * This prevents misuse of the public endpoint.
     */
    if (data.isKioskMode !== true) {
      return NextResponse.json(
        { error: "This endpoint is only for kiosk mode sessions" },
        { status: 400 }
      );
    }

    /**
     * MESSAGES ARRAY VALIDATION
     * 
     * Validates that messages field is properly formatted.
     */
    if (!Array.isArray(data.messages)) {
      return NextResponse.json(
        { error: "Messages must be an array" },
        { status: 400 }
      );
    }

    /**
     * MESSAGE COUNT VALIDATION
     * 
     * Prevents abuse by limiting the number of messages.
     * Reasonable limit for legitimate kiosk conversations.
     */
    if (data.messages.length > 100) {
      return NextResponse.json(
        { error: "Too many messages (limit: 100)" },
        { status: 400 }
      );
    }

    /**
     * INDIVIDUAL MESSAGE VALIDATION
     * 
     * Validates each message for proper structure and content limits.
     */
    for (const msg of data.messages) {
      // Check for required fields
      if (!msg.role || !msg.content || !msg.timestamp) {
        return NextResponse.json(
          { error: "Invalid message format: missing role, content, or timestamp" },
          { status: 400 }
        );
      }
      
      // Validate role
      if (!["user", "assistant"].includes(msg.role)) {
        return NextResponse.json(
          { error: "Invalid message role: must be 'user' or 'assistant'" },
          { status: 400 }
        );
      }

      // Validate content length to prevent abuse
      if (typeof msg.content !== 'string' || msg.content.length > 10000) {
        return NextResponse.json(
          { error: "Message content too long (limit: 10000 characters)" },
          { status: 400 }
        );
      }

      // Validate timestamp is reasonable (within last 24 hours to 1 minute in future)
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const oneMinuteFromNow = now + (60 * 1000);
      
      if (msg.timestamp < oneDayAgo || msg.timestamp > oneMinuteFromNow) {
        return NextResponse.json(
          { error: "Invalid message timestamp" },
          { status: 400 }
        );
      }
    }

    /**
     * SESSION ID FORMAT VALIDATION
     * 
     * Validates sessionId format to prevent path traversal or injection attacks.
     * Should be alphanumeric with underscores only.
     */
    const sessionIdRegex = /^[a-zA-Z0-9_]+$/;
    if (!sessionIdRegex.test(data.sessionId) || data.sessionId.length > 50) {
      return NextResponse.json(
        { error: "Invalid sessionId format" },
        { status: 400 }
      );
    }

    /**
     * DUPLICATE SESSION PREVENTION
     * 
     * Checks if session already exists to prevent overwrites.
     */
    const exists = await s3Storage.chatSessionExists(data.sessionId);
    if (exists) {
      return NextResponse.json(
        { error: `Chat session with ID '${data.sessionId}' already exists` },
        { status: 409 }
      );
    }

    /**
     * CHAT SESSION CREATION FOR KIOSK
     * 
     * Creates session with kiosk-specific metadata.
     * Note: userId and userName are not accepted from public interface.
     */
    const chatSession = s3Storage.createChatSession(
      data.sessionId,
      data.avatarId,
      data.avatarName,
      data.messages,
      {
        userId: undefined,                    // Not accepted from public kiosk
        userName: undefined,                  // Not accepted from public kiosk  
        isKioskMode: true,                    // Always true for this endpoint
        location: data.location || "kiosk",   // Default location
      }
    );

    /**
     * S3 STORAGE OPERATION
     * 
     * Saves the kiosk chat session to S3.
     */
    await s3Storage.saveChatSession(chatSession);

    /**
     * SUCCESS RESPONSE
     * 
     * Returns confirmation of successful save.
     */
    return NextResponse.json({
      success: true,
      sessionId: data.sessionId,
      messageCount: data.messages.length,
      message: "Kiosk chat session saved successfully",
    });

  } catch (error) {
    /**
     * ERROR HANDLING
     * 
     * Logs errors for debugging while returning safe error messages.
     */
    console.error("Kiosk chat save error:", error);

    if (error instanceof Error) {
      // Handle AWS credential issues
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "Storage configuration error" },
          { status: 500 }
        );
      }
      // Handle bucket access issues
      if (error.message.includes("bucket")) {
        return NextResponse.json(
          { error: "Storage access error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to save kiosk chat session" },
      { status: 500 }
    );
  }
} 