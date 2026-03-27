import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { VideoAudioProfile } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const profile: VideoAudioProfile = await request.json();

    if (!profile.id || !profile.name || !profile.avatarName || !profile.voice?.voiceId) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, avatarName, voice.voiceId" },
        { status: 400 }
      );
    }

    const exists = await s3Storage.profileExists(profile.id);
    if (exists) {
      return NextResponse.json(
        { error: `Profile with ID '${profile.id}' already exists` },
        { status: 409 }
      );
    }

    await s3Storage.saveProfile(profile);

    return NextResponse.json({
      success: true,
      profile,
      message: "Profile created successfully",
    });
  } catch (error) {
    console.error("Profile add error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
