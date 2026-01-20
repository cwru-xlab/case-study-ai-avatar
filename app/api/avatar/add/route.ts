import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Avatar } from "@/lib/avatar-storage";

export async function POST(request: NextRequest) {
  try {
    const avatar: Avatar = await request.json();

    // Validate required fields
    if (!avatar.id || !avatar.name || !avatar.systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, systemPrompt" },
        { status: 400 }
      );
    }

    // Check if avatar already exists
    const exists = await s3Storage.avatarExists(avatar.id);
    if (exists) {
      return NextResponse.json(
        { error: `Avatar with ID '${avatar.id}' already exists` },
        { status: 409 }
      );
    }

    // Save to S3 and get version
    const version = await s3Storage.saveAvatar(avatar);

    return NextResponse.json({
      success: true,
      avatar,
      version,
      message: "Avatar created successfully",
    });
  } catch (error) {
    console.error("Avatar add error:", error);

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
      { error: "Failed to create avatar" },
      { status: 500 }
    );
  }
}
