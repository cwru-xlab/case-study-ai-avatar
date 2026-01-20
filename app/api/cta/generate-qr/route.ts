import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { ctaStorage } from "@/lib/cta-storage";
import type { QRCodeData } from "@/types";

/**
 * POST /api/cta/generate-qr
 * 
 * Generate a QR code for the current chat session.
 * 
 * Request Body:
 * {
 *   sessionId: string,        // Current chat session ID
 *   avatarId: string,         // Current avatar ID
 *   avatarName: string        // Current avatar name
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   qrCodeDataUrl: string,    // Base64 data URL for the QR code image
 *   qrCodeUrl: string,        // The URL encoded in the QR code
 *   timestamp: number         // When the QR code was generated
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const data = await request.json();

    /**
     * INPUT VALIDATION
     * 
     * Validate required fields for QR code generation.
     */
    if (!data.sessionId || !data.avatarId || !data.avatarName) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing required fields: sessionId, avatarId, avatarName" 
        },
        { status: 400 }
      );
    }

    /**
     * SESSION ID VALIDATION
     * 
     * Validate session ID format to prevent injection attacks.
     */
    const sessionIdRegex = /^[a-zA-Z0-9_-]+$/;

    if (!sessionIdRegex.test(data.sessionId) || data.sessionId.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid sessionId format",
        },
        { status: 400 },
      );
    }

    /**
     * CTA CONFIGURATION CHECK
     * 
     * Verify that the CTA feature is enabled before generating QR codes.
     */
    const config = await ctaStorage.getConfig();

    if (!config.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: "CTA feature is disabled",
        },
        { status: 503 },
      );
    }

    /**
     * QR CODE DATA PREPARATION
     * 
     * Create the data structure that will be encoded in the QR code.
     * This includes session information and a timestamp for cache busting.
     */
    const timestamp = Date.now();
    const qrData: QRCodeData = {
      sessionId: data.sessionId,
      avatarId: data.avatarId,
      avatarName: data.avatarName,
      timestamp,
      version: "1.0",
    };

    /**
     * QR CODE URL CONSTRUCTION
     * 
     * Build the URL that will be encoded in the QR code.
     * This points to the CTA form with session data as query parameters.
     * 
     * Auto-detect the base URL from the current request to work automatically
     * in all environments (localhost, network IP, deployed domain).
     * Falls back to configured URL if provided.
     */
    const host = request.headers.get("host");
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      (host?.includes("localhost") ? "http" : "https");
    const autoDetectedUrl = `${protocol}://${host}`;

    // Use configured URL if provided, otherwise auto-detect
    const baseUrl =
      config.qrCodeBaseUrl && config.qrCodeBaseUrl.trim()
        ? config.qrCodeBaseUrl
        : autoDetectedUrl;
    
    const formUrl = new URL(`${baseUrl}/cta/form`);
    
    // Add session data as query parameters
    formUrl.searchParams.set("sessionId", qrData.sessionId);
    formUrl.searchParams.set("avatarId", qrData.avatarId);
    formUrl.searchParams.set("avatarName", qrData.avatarName);
    formUrl.searchParams.set("timestamp", qrData.timestamp.toString());
    formUrl.searchParams.set("version", qrData.version);

    const qrCodeUrl = formUrl.toString();

    /**
     * QR CODE GENERATION
     * 
     * Generate the QR code image using the qrcode library.
     * Configured for optimal scanning on mobile devices.
     */
    const qrCodeOptions: QRCode.QRCodeToDataURLOptions = {
      type: "image/png",
      margin: 1,
      color: {
        dark: "#000000",    // Black QR code
        light: "#FFFFFF"    // White background
      },
      width: 256,           // 256x256 pixels for good mobile scanning
      errorCorrectionLevel: "M" // Medium error correction (suitable for kiosk display)
    };

    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, qrCodeOptions);


    const response = NextResponse.json({
      success: true,
      qrCodeDataUrl,
      qrCodeUrl,
      timestamp,
      sessionId: data.sessionId,
      avatarName: data.avatarName
    });

    /**
     * CACHING HEADERS
     * 
     * Set appropriate caching headers for QR codes.
     * Short cache duration since QR codes change with session ID.
     */
    response.headers.set(
      "Cache-Control",
      "public, max-age=300, must-revalidate",
    ); // 5 minutes
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("QR code generation error:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("Invalid URL")) {
        return NextResponse.json(
          { 
            success: false,
            error: "Invalid configuration URL" 
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to generate QR code" 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cta/generate-qr
 * 
 * Health check endpoint for QR code generation service.
 * Returns the current CTA configuration status.
 */
export async function GET() {
  try {
    const config = await ctaStorage.getConfig();
    
    return NextResponse.json({
      success: true,
      enabled: config.enabled,
      message: config.enabled 
        ? "QR code generation is available" 
        : "QR code generation is disabled"
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("QR code service health check error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "QR code service unavailable" 
      },
      { status: 500 }
    );
  }
}