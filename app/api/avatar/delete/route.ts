import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing avatar ID" }, { status: 400 });
    }

    // Check if avatar exists
    const exists = await s3Storage.avatarExists(id);
    if (!exists) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Delete from S3
    await s3Storage.deleteAvatar(id);

    return NextResponse.json({
      success: true,
      id,
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    console.error("Avatar delete error:", error);

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
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
