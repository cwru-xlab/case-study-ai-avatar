import { NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET() {
  try {
    const profiles = await s3Storage.listProfiles();

    return NextResponse.json({
      success: true,
      profiles,
      message: "Profiles retrieved successfully",
    });
  } catch (error) {
    console.error("Profile list error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to list profiles" },
      { status: 500 }
    );
  }
}
