
import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function POST(request: NextRequest) {
  try {
    // Request parsing and validation
    const body = await request.json();
    
    // Validate required fields
    if (!body.sessionId || !body.avatarId || !body.avatarName || !body.timestamp) {
      return NextResponse.json(
        { 
          valid: false,
          error: "Missing required QR code data" 
        },
        { status: 400 }
      );
    }

    const { sessionId, avatarId, avatarName, timestamp, version } = body;

    // Session ID format validation
    const sessionIdRegex = /^[0-9]+_[a-zA-Z0-9]+$/;
    if (!sessionIdRegex.test(sessionId)) {
      return NextResponse.json(
        { 
          valid: false,
          error: "Invalid session ID format" 
        },
        { status: 400 }
      );
    }

    // Timestamp validation
    const now = Date.now();
    const qrCodeAge = now - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (qrCodeAge > maxAge) {
      return NextResponse.json(
        { 
          valid: false,
          error: "QR code has expired" 
        },
        { status: 400 }
      );
    }

    // Session ID timestamp validation
    const sessionTimestamp = parseInt(sessionId.split('_')[0]);
    if (isNaN(sessionTimestamp) || sessionTimestamp <= 0) {
      return NextResponse.json(
        { 
          valid: false,
          error: "Invalid session timestamp" 
        },
        { status: 400 }
      );
    }

    // Check if session timestamp is reasonable (within last 24 hours, not future)
    const sessionAge = now - sessionTimestamp;
    if (sessionAge > maxAge || sessionAge < -60000) { // Allow 1 minute future for clock skew
      return NextResponse.json(
        { 
          valid: false,
          error: "Session timestamp is invalid" 
        },
        { status: 400 }
      );
    }

    // Check S3 for saved session
    try {
      const savedSession = await s3Storage.getChatSession(sessionId);
      if (savedSession) {
        // Session exists in S3 - it's a completed session
        return NextResponse.json({
          valid: true,
          sessionData: {
            sessionId: savedSession.metadata.sessionId,
            avatarId: savedSession.metadata.avatarId,
            avatarName: savedSession.metadata.avatarName,
            messageCount: savedSession.messages?.length || 0,
            isActive: false
          }
        });
      }
    } catch (error) {
      // Session not in S3, continue to check if it's an active session
      console.log(`Session ${sessionId} not found in S3, checking if it's active`);
    }

    // Active session validation
    // Validate avatar ID format (should be kebab-case)
    const avatarIdRegex = /^[a-z0-9-]+$/;
    if (!avatarIdRegex.test(avatarId)) {
      return NextResponse.json(
        { 
          valid: false,
          error: "Invalid avatar ID format" 
        },
        { status: 400 }
      );
    }

    // Validate avatar name (should be reasonable format)
    if (!avatarName || avatarName.length > 100 || avatarName.length < 2) {
      return NextResponse.json(
        { 
          valid: false,
          error: "Invalid avatar name" 
        },
        { status: 400 }
      );
    }

    // Consistency check
    const timeDifference = Math.abs(timestamp - sessionTimestamp);
    const maxTimeDifference = 10 * 60 * 1000; // 10 minutes

    if (timeDifference > maxTimeDifference) {
      return NextResponse.json(
        { 
          valid: false,
          error: "QR code and session timestamps don't match" 
        },
        { status: 400 }
      );
    }

    // Active session validation passed
    return NextResponse.json({
      valid: true,
      sessionData: {
        sessionId,
        avatarId,
        avatarName,
        messageCount: 0, // Unknown for active sessions
        isActive: true
      }
    });

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Session validation error:", error);

    return NextResponse.json(
      { 
        valid: false,
        error: "Session validation failed" 
      },
      { status: 500 }
    );
  }
}