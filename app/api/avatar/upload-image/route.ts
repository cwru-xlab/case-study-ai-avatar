import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

// File validation constants
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

/**
 * Avatar Image Upload Endpoint
 *
 * Handles multipart form data upload of avatar images with validation.
 * Uploads to S3 and updates the avatar's portrait field.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const avatarId = formData.get("avatarId") as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG and PNG images are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
        },
        { status: 400 }
      );
    }

    // Basic validation - we'll rely on client-side dimension validation
    // Server-side dimension validation would require additional image processing libraries
    // For now, we trust the client-side validation in the ImageUploadCrop component

    // Check if avatar exists in S3
    const avatarExists = await s3Storage.avatarExists(avatarId);
    if (!avatarExists) {
      return NextResponse.json(
        { error: `Avatar with ID '${avatarId}' not found` },
        { status: 404 }
      );
    }

    // Delete any existing avatar image
    try {
      await s3Storage.deleteAvatarImage(avatarId);
    } catch (error) {
      console.warn("Failed to delete existing avatar image:", error);
      // Continue with upload even if deletion fails
    }

    // Upload new image to S3
    const publicUrl = await s3Storage.uploadAvatarImage(avatarId, file);

    // Update avatar JSON in S3 with new portrait URL
    const avatar = await s3Storage.getAvatar(avatarId);
    if (avatar) {
      avatar.portrait = publicUrl;
      avatar.lastEditedAt = new Date().toISOString();
      await s3Storage.saveAvatar(avatar);
    }

    return NextResponse.json({
      success: true,
      avatarId,
      portraitUrl: publicUrl,
      message: "Avatar image uploaded successfully",
    });
  } catch (error) {
    console.error("Avatar image upload error:", error);

    // Handle specific S3 errors
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
      if (error.message.includes("bucket")) {
        return NextResponse.json(
          { error: "S3 bucket access error" },
          { status: 500 }
        );
      }
      if (error.message.includes("ACL")) {
        return NextResponse.json(
          { error: "S3 permissions error. Please check bucket ACL settings." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to upload avatar image" },
      { status: 500 }
    );
  }
}

/**
 * Delete Avatar Image Endpoint
 *
 * Removes the avatar's custom image and reverts to generated avatar.
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const avatarId = url.searchParams.get("avatarId");

    if (!avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required" },
        { status: 400 }
      );
    }

    // Check if avatar exists in S3
    const avatarExists = await s3Storage.avatarExists(avatarId);
    if (!avatarExists) {
      return NextResponse.json(
        { error: `Avatar with ID '${avatarId}' not found` },
        { status: 404 }
      );
    }

    // Delete image from S3
    await s3Storage.deleteAvatarImage(avatarId);

    // Update avatar JSON in S3 to remove portrait URL
    const avatar = await s3Storage.getAvatar(avatarId);
    if (avatar) {
      avatar.portrait = undefined;
      avatar.lastEditedAt = new Date().toISOString();
      await s3Storage.saveAvatar(avatar);
    }

    return NextResponse.json({
      success: true,
      avatarId,
      message: "Avatar image deleted successfully",
    });
  } catch (error) {
    console.error("Avatar image delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete avatar image" },
      { status: 500 }
    );
  }
}
