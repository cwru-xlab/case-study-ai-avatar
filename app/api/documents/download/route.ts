import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId");
    const avatarId = searchParams.get("avatarId");

    if (!sourceId) {
      return NextResponse.json(
        { error: "Source ID is required" },
        { status: 400 }
      );
    }

    // Get document metadata to retrieve filename
    const metadata = await s3Storage.getDocumentMetadata(sourceId);
    if (!metadata || !metadata.filename) {
      return NextResponse.json(
        { error: "Document metadata not found" },
        { status: 404 }
      );
    }

    // Validate access control based on avatarId
    if (avatarId && metadata.avatarId !== avatarId) {
      return NextResponse.json(
        { error: "Access denied: Document belongs to a different avatar" },
        { status: 403 }
      );
    }

    // If no avatarId provided, only allow access to shared documents
    if (!avatarId && metadata.avatarId) {
      return NextResponse.json(
        { error: "Access denied: Document requires avatar-specific access" },
        { status: 403 }
      );
    }

    // Construct the S3 key with filename
    const s3Key = `knowledge-base/${sourceId}/${metadata.filename}`;

    try {
      // Download the file from S3
      const { body, contentType } = await s3Storage.downloadFile(s3Key);

      // Create response with appropriate headers
      const headers = new Headers();
      headers.set('Content-Type', contentType || 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${metadata.filename}"`);
      headers.set('Content-Length', body.length.toString());

      return new NextResponse(Buffer.from(body), {
        status: 200,
        headers,
      });
    } catch (s3Error) {
      console.error("S3 download error:", s3Error);
      return NextResponse.json(
        { error: "File not found or access denied" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}