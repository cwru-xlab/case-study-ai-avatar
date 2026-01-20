/**
 * CHAT SAVE API ENDPOINT
 * 
 * Implements the core API for saving chat sessions to S3 storage.
 * This endpoint serves as the primary entry point for saving chat sessions
 * as JSON files in S3 under the /chats/ prefix.
 * 
 * Purpose:
 * - Manual chat session saving via API calls
 * - Backup/export functionality for chat sessions
 * - Administrative tools for chat management
 * - Testing and development utilities
 * 
 * Security:
 * - Protected by middleware (admin-only access)
 * - Comprehensive input validation
 * - Error handling that doesn't leak sensitive information
 * 
 * Integration:
 * - Works alongside the chat-storage.ts service
 * - Uses the same S3 client infrastructure as avatar storage
 * - Follows the same API patterns as existing avatar endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { chatStorage } from "@/lib/chat-storage";
import { s3Storage } from "@/lib/s3-client";
import type { ChatMessage } from "@/types";

/**
 * POST /api/chat/save
 * 
 * Save a chat session to S3 storage with comprehensive validation.
 * 
 * Request Body:
 * {
 *   sessionId: string,           // Unique session identifier
 *   avatarId: string,            // Avatar involved in conversation
 *   avatarName: string,          // Avatar display name
 *   messages: ChatMessage[],     // Complete conversation history
 *   userId?: string,             // Optional user identifier
 *   userName?: string,           // Optional user name  
 *   isKioskMode?: boolean,       // Whether this was a kiosk interaction
 *   location?: string            // Optional location identifier
 * }
 * 
 * Response (Success):
 * {
 *   success: true,
 *   sessionId: string,
 *   messageCount: number,
 *   message: "Chat session saved successfully"
 * }
 * 
 * Response (Error):
 * {
 *   error: string
 * }
 * 
 * Error Codes:
 * - 400: Missing required fields or invalid data format
 * - 409: Session ID already exists (duplicate prevention)
 * - 500: S3 storage errors or internal server errors
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const data = await request.json();
    
    /**
     * REQUIRED FIELD VALIDATION
     * 
     * Ensures all essential fields are present for a valid chat session.
     * These fields are required for proper storage and future retrieval.
     * 
     * sessionId: Must be unique across all sessions
     * avatarId: Links session to specific avatar for analytics
     * avatarName: Human-readable avatar identifier for display
     * messages: The actual conversation content (can be empty array)
     */
    if (!data.sessionId || !data.avatarId || !data.avatarName || !data.messages) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, avatarId, avatarName, messages" },
        { status: 400 }
      );
    }

    /**
     * MESSAGES ARRAY VALIDATION
     * 
     * Validates that messages field is properly formatted.
     * Prevents runtime errors during storage operations.
     */
    if (!Array.isArray(data.messages)) {
      return NextResponse.json(
        { error: "Messages must be an array" },
        { status: 400 }
      );
    }

    /**
     * INDIVIDUAL MESSAGE VALIDATION
     * 
     * Validates each message in the conversation for proper structure.
     * Ensures compatibility with ChatMessage interface and prevents
     * storage of malformed data that could break retrieval operations.
     */
    for (const msg of data.messages) {
      // Check for required fields on each message
      if (!msg.role || !msg.content || !msg.timestamp) {
        return NextResponse.json(
          { error: "Invalid message format: missing role, content, or timestamp" },
          { status: 400 }
        );
      }
      // Validate role is one of the allowed values
      if (!["user", "assistant"].includes(msg.role)) {
        return NextResponse.json(
          { error: "Invalid message role: must be 'user' or 'assistant'" },
          { status: 400 }
        );
      }
    }

    /**
     * DUPLICATE SESSION PREVENTION
     * 
     * Checks if a session with this ID already exists in S3.
     * Prevents accidental overwrites and maintains data integrity.
     */
    const exists = await s3Storage.chatSessionExists(data.sessionId);
    if (exists) {
      return NextResponse.json(
        { error: `Chat session with ID '${data.sessionId}' already exists` },
        { status: 409 }
      );
    }

    /**
     * CHAT SESSION CREATION AND STORAGE
     * 
     * Uses the S3 client's factory method to create a properly structured
     * ChatSession object with all required metadata fields.
     * 
     * This ensures:
     * - Consistent session structure across the application
     * - Proper metadata calculation (start/end times, message count)
     * - Standard audit fields (createdAt, updatedAt)
     * - Compatibility with analytics and reporting tools
     */
    const chatSession = s3Storage.createChatSession(
      data.sessionId,
      data.avatarId,
      data.avatarName,
      data.messages,
      {
        userId: data.userId,
        userName: data.userName,
        isKioskMode: data.isKioskMode || false,    // Default to preview mode
        location: data.location,
      }
    );

    /**
     * S3 STORAGE OPERATION
     * 
     * Saves the complete chat session to S3 as a JSON file.
     * Storage path: chats/{sessionId}.json
     * Content: Complete ChatSession object with metadata and messages
     */
    await s3Storage.saveChatSession(chatSession);

    /**
     * SUCCESS RESPONSE
     * 
     * Returns essential information about the saved session.
     * Includes metadata that's useful for confirmation and logging.
     */
    return NextResponse.json({
      success: true,
      sessionId: data.sessionId,
      messageCount: data.messages.length,
      message: "Chat session saved successfully",
    });

  } catch (error) {
    /**
     * ERROR HANDLING AND LOGGING
     * 
     * Comprehensive error handling that:
     * - Logs detailed errors for debugging
     * - Returns safe error messages to clients
     * - Handles specific S3 error types
     * - Maintains security by not leaking sensitive information
     */
    console.error("Chat save error:", error);

    /**
     * S3-SPECIFIC ERROR HANDLING
     * 
     * Provides specific error messages for common S3 issues.
     * This helps administrators quickly identify and resolve issues.
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
     * Provides a safe, generic error message while logging
     * the actual error details for debugging.
     */
    return NextResponse.json(
      { error: "Failed to save chat session" },
      { status: 500 }
    );
  }
} 