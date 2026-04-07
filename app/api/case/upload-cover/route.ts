import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const caseId = formData.get("caseId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!caseId) {
      return NextResponse.json(
        { error: "Case ID is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    // Delete any existing cover image
    try {
      await s3Storage.deleteCaseCoverImage(caseId);
    } catch (error) {
      console.warn("Failed to delete existing cover image:", error);
    }

    // Upload new image to S3
    const publicUrl = await s3Storage.uploadCaseCoverImage(caseId, file);

    return NextResponse.json({
      success: true,
      caseId,
      url: publicUrl,
      message: "Cover image uploaded successfully",
    });
  } catch (error) {
    console.error("Case cover image upload error:", error);

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
      { error: "Failed to upload cover image" },
      { status: 500 }
    );
  }
}
