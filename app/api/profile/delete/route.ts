import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Missing profile ID" },
        { status: 400 }
      );
    }

    const exists = await s3Storage.profileExists(id);
    if (!exists) {
      return NextResponse.json(
        { error: `Profile with ID '${id}' not found` },
        { status: 404 }
      );
    }

    await s3Storage.deleteProfile(id);

    return NextResponse.json({
      success: true,
      id,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Profile delete error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 }
    );
  }
}
