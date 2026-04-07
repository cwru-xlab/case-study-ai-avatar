import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const avatarId = formData.get("avatarId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!avatarId) {
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG and PNG images are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const profile = await s3Storage.getProfile(avatarId);
    if (!profile) {
      return NextResponse.json(
        { error: `Profile with ID '${avatarId}' not found` },
        { status: 404 }
      );
    }

    try {
      await s3Storage.deleteProfileImage(avatarId);
    } catch {
      // continue even if deletion fails
    }

    const publicUrl = await s3Storage.uploadProfileImage(avatarId, file);

    profile.portrait = publicUrl;
    profile.lastEditedAt = new Date().toISOString();
    await s3Storage.saveProfile(profile);

    return NextResponse.json({ success: true, portraitUrl: publicUrl });
  } catch (error) {
    console.error("Profile image upload error:", error);
    return NextResponse.json({ error: "Failed to upload profile image" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const avatarId = url.searchParams.get("avatarId");

    if (!avatarId) {
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    const profile = await s3Storage.getProfile(avatarId);
    if (!profile) {
      return NextResponse.json(
        { error: `Profile with ID '${avatarId}' not found` },
        { status: 404 }
      );
    }

    await s3Storage.deleteProfileImage(avatarId);

    profile.portrait = undefined;
    profile.lastEditedAt = new Date().toISOString();
    await s3Storage.saveProfile(profile);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile image delete error:", error);
    return NextResponse.json({ error: "Failed to delete profile image" }, { status: 500 });
  }
}
