import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function POST(request: NextRequest) {
  try {
    const { localVersions } = await request.json();

    // Validate input
    if (!localVersions || typeof localVersions !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid localVersions object" },
        { status: 400 }
      );
    }

    // Compare with server versions
    const syncResult = await s3Storage.compareVersions(localVersions);

    return NextResponse.json({
      success: true,
      ...syncResult,
      message: "Sync comparison completed",
    });
  } catch (error) {
    console.error("Avatar sync error:", error);

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
      { error: "Failed to sync avatars" },
      { status: 500 }
    );
  }
}

// Also support GET for version manifest retrieval
export async function GET() {
  try {
    const manifest = await s3Storage.getVersionManifest();

    return NextResponse.json({
      success: true,
      manifest,
      message: "Version manifest retrieved",
    });
  } catch (error) {
    console.error("Avatar manifest retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to get version manifest" },
      { status: 500 }
    );
  }
}
