import type { CTAConfig } from "@/types";

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

import { ctaStorage } from "@/lib/cta-storage";
import { siteConfig } from "@/config/site";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function GET(_request: NextRequest) {
  try {
    const config = await ctaStorage.getConfig();

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("CTA config retrieval error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load CTA configuration",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/cta/config
 *
 * Update CTA configuration settings.
 *
 * Request Body:
 * Partial<CTAConfig> - Only fields to update
 *
 * Response:
 * {
 *   success: true,
 *   config: CTAConfig,
 *   message: string
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // Extract user information from JWT token
    const token = request.cookies.get(siteConfig.auth.cookie.name)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const updatedBy = (payload.name as string) || "Unknown Admin";

    // Parse request body
    const updateData: Partial<CTAConfig> = await request.json();

    // Validate update data
    const validationErrors = validateConfigUpdate(updateData);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: validationErrors.join("; "),
        },
        { status: 400 },
      );
    }

    // Update configuration
    const updatedConfig = await ctaStorage.updateConfig(updateData, updatedBy);

    // eslint-disable-next-line no-console
    console.log(
      `CTA configuration updated by ${updatedBy}:`,
      Object.keys(updateData),
    );

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: "Configuration updated successfully",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("CTA config update error:", error);

    if (error instanceof Error) {
      if (error.message.includes("JWT")) {
        return NextResponse.json(
          { success: false, error: "Invalid authentication" },
          { status: 401 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update CTA configuration",
      },
      { status: 500 },
    );
  }
}

/**
 * Validate Configuration Update Data
 *
 * Validates the fields being updated in the CTA configuration.
 */
function validateConfigUpdate(data: Partial<CTAConfig>): string[] {
  const errors: string[] = [];

  // Validate enabled flag
  if (data.enabled !== undefined && typeof data.enabled !== "boolean") {
    errors.push("Enabled must be a boolean value");
  }

  // Validate email recipients
  if (data.emailRecipients !== undefined) {
    if (!Array.isArray(data.emailRecipients)) {
      errors.push("Email recipients must be an array");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of data.emailRecipients) {
        if (typeof email !== "string" || !emailRegex.test(email)) {
          errors.push(`Invalid email address: ${email}`);
        }
      }
    }
  }

  // Validate QR code base URL (optional - empty string triggers auto-detection)
  if (data.qrCodeBaseUrl !== undefined) {
    if (typeof data.qrCodeBaseUrl !== "string") {
      errors.push("QR code base URL must be a string");
    } else if (data.qrCodeBaseUrl.trim() !== "") {
      // Only validate if not empty (empty string = auto-detect)
      try {
        new URL(data.qrCodeBaseUrl);
      } catch {
        errors.push(
          "QR code base URL must be a valid URL or empty for auto-detection",
        );
      }
    }
  }

  // Validate string fields
  const stringFields = [
    "formTitle",
    "formDescription",
    "submitButtonText",
    "successMessage",
    "emailSubject",
    "emailTemplate",
  ];

  for (const field of stringFields) {
    if (data[field as keyof CTAConfig] !== undefined) {
      const value = data[field as keyof CTAConfig];

      if (typeof value !== "string") {
        errors.push(`${field} must be a string`);
      } else if (value.length > 5000) {
        errors.push(`${field} must be less than 5000 characters`);
      }
    }
  }

  // Validate max message length
  if (data.maxMessageLength !== undefined) {
    if (typeof data.maxMessageLength !== "number") {
      errors.push("Max message length must be a number");
    } else if (data.maxMessageLength < 100 || data.maxMessageLength > 2000) {
      errors.push("Max message length must be between 100 and 2000 characters");
    }
  }

  return errors;
}