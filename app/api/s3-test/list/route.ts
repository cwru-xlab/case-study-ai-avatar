import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

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
 * GET /api/s3-test/list
 *
 * List all files in the S3 bucket for testing purposes.
 *
 * Query Parameters:
 * - prefix?: string    // Optional prefix to filter files
 * - maxKeys?: string   // Maximum number of files to return (default 100)
 *
 * Response:
 * {
 *   success: true,
 *   files: [
 *     {
 *       key: string,
 *       size: number,
 *       lastModified: string,
 *       etag: string
 *     }
 *   ],
 *   total: number,
 *   truncated: boolean
 * }
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
    const prefix = searchParams.get("prefix") || "";
    const maxKeys = parseInt(searchParams.get("maxKeys") || "100", 10);

    // Validate maxKeys
    if (isNaN(maxKeys) || maxKeys <= 0 || maxKeys > 1000) {
      return NextResponse.json(
        { error: "Invalid maxKeys: must be between 1 and 1000" },
        { status: 400 }
      );
    }

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await s3Client.send(command);

    const files = (response.Contents || []).map((obj) => ({
      key: obj.Key || "",
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || "",
      etag: obj.ETag || "",
    }));

    return NextResponse.json({
      success: true,
      files,
      total: files.length,
      truncated: response.IsTruncated || false,
      prefix,
    });
  } catch (error) {
    console.error("Failed to list S3 files:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list files",
      },
      { status: 500 }
    );
  }
}
