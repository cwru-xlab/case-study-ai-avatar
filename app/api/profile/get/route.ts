import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing profile ID parameter" },
        { status: 400 }
      );
    }

    const profile = await s3Storage.getProfile(id);

    if (!profile) {
      return NextResponse.json(
        { error: `Profile with ID '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
      message: "Profile retrieved successfully",
    });
  } catch (error) {
    console.error("Profile get error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to retrieve profile" },
      { status: 500 }
    );
  }
}
