import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { VideoAudioProfile } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { id, profile } = (await request.json()) as {
      id: string;
      profile: Partial<VideoAudioProfile>;
    };

    if (!id || !profile) {
      return NextResponse.json(
        { error: "Missing required fields: id, profile" },
        { status: 400 }
      );
    }

    const existing = await s3Storage.getProfile(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Profile with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const updatedProfile: VideoAudioProfile = {
      ...existing,
      ...profile,
      id,
      lastEditedAt: new Date().toISOString(),
    };

    await s3Storage.saveProfile(updatedProfile);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Profile edit error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
