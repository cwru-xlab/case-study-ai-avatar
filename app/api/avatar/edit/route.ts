import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Avatar } from "@/lib/avatar-storage";

export async function POST(request: NextRequest) {
  try {
    const { id, avatar, expectedVersion } = await request.json();

    // Validate required fields
    if (!id || !avatar) {
      return NextResponse.json(
        { error: "Missing required fields: id, avatar" },
        { status: 400 }
      );
    }

    // Check if avatar exists
    const existingAvatar = await s3Storage.getAvatar(id);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Version conflict check (optional but recommended)
    if (expectedVersion) {
      const manifest = await s3Storage.getVersionManifest();
      const currentVersion = manifest.avatars[id]?.version || 0;

      if (currentVersion > expectedVersion) {
        return NextResponse.json(
          {
            error: "Version conflict: Avatar was modified by another user",
            currentVersion,
            expectedVersion,
          },
          { status: 409 }
        );
      }
    }

    // Prepare updated avatar data
    const updatedAvatar: Avatar = {
      ...existingAvatar,
      ...avatar,
      id, // Ensure ID doesn't change
      lastEditedAt: new Date().toISOString(),
    };

    // Save to S3 and get new version
    const version = await s3Storage.saveAvatar(updatedAvatar);

    return NextResponse.json({
      success: true,
      avatar: updatedAvatar,
      version,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("Avatar edit error:", error);

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
    }

    return NextResponse.json(
      { error: "Failed to update avatar" },
      { status: 500 }
    );
  }
}
