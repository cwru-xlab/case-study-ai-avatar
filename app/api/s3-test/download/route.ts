import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// S3 client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

/**
 * GET /api/s3-test/download?key=<file-key>
 *
 * Download a specific file from S3 by its key.
 *
 * Query Parameters:
 * - key: string (required)  // S3 object key to download
 *
 * Response:
 * - On success: Binary file data with appropriate headers
 * - On error: JSON error response
 */
export async function GET(request: NextRequest) {
  // SECURITY: Only allow in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "S3 test endpoints are only available in development mode" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Missing required parameter: key" },
        { status: 400 }
      );
    }

    // Validate key to prevent path traversal or other issues
    if (key.includes("..") || key.startsWith("/")) {
      return NextResponse.json(
        { error: "Invalid key format" },
        { status: 400 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Convert stream to byte array
    const body = await response.Body.transformToByteArray();

    // Extract filename from key for Content-Disposition header
    const filename = key.split("/").pop() || "download";

    // Create response with appropriate headers
    const headers = new Headers();
    headers.set(
      "Content-Type",
      response.ContentType || "application/octet-stream"
    );
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set("Content-Length", body.length.toString());
    headers.set("Cache-Control", "no-cache");

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("Failed to download S3 file:", error);

    // Handle specific S3 errors
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (
      error.name === "AccessDenied" ||
      error.$metadata?.httpStatusCode === 403
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to download file",
      },
      { status: 500 }
    );
  }
}
