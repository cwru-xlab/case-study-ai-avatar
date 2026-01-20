import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing avatar ID parameter" },
        { status: 400 }
      );
    }

    // Get avatar from S3
    const avatar = await s3Storage.getAvatar(id);

    if (!avatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Get version info
    const manifest = await s3Storage.getVersionManifest();
    const version = manifest.avatars[id]?.version || 0;

    return NextResponse.json({
      success: true,
      ...avatar,
      version,
      message: "Avatar retrieved successfully",
    });
  } catch (error) {
    console.error("Avatar get error:", error);

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
      { error: "Failed to retrieve avatar" },
      { status: 500 }
    );
  }
}
