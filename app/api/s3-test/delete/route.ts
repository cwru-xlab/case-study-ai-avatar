import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

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
 * Delete a single file from S3
 */
async function deleteSingleFile(key: string): Promise<NextResponse> {
  try {
    // Check if the object exists before trying to delete it
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(headCommand);
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    // Re-throw other errors
    throw error;
  }

  // Delete the object
  const deleteCommand = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(deleteCommand);

  return NextResponse.json({
    success: true,
    message: "File deleted successfully",
    key,
  });
}

/**
 * Delete an entire folder (all objects with the given prefix) from S3
 */
async function deleteFolderRecursive(prefix: string): Promise<NextResponse> {
  try {
    // Ensure prefix ends with / for proper folder matching
    const folderPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

    let deletedCount = 0;
    let continuationToken: string | undefined;

    do {
      // List objects with the prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: folderPrefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000, // Maximum allowed by S3
      });

      const listResponse = await s3Client.send(listCommand);
      const objects = listResponse.Contents || [];

      if (objects.length === 0) {
        if (deletedCount === 0) {
          return NextResponse.json(
            { error: "Folder not found or is empty" },
            { status: 404 }
          );
        }
        break;
      }

      // Delete objects in batches (S3 allows up to 1000 per batch)
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key! })),
          Quiet: false, // Return info about deleted objects
        },
      });

      const deleteResponse = await s3Client.send(deleteCommand);
      deletedCount += deleteResponse.Deleted?.length || 0;

      // Check for deletion errors
      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        console.error("Some objects failed to delete:", deleteResponse.Errors);
        // Continue with partial deletion but report errors
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json({
      success: true,
      message: `Folder deleted successfully (${deletedCount} objects)`,
      key: prefix,
      deletedCount,
    });
  } catch (error: any) {
    console.error("Failed to delete folder:", error);
    throw error;
  }
}

/**
 * DELETE /api/s3-test/delete
 *
 * Delete a specific file or entire folder from S3 by its key.
 *
 * Request Body:
 * {
 *   key: string,           // S3 object key to delete
 *   isFolder?: boolean     // If true, deletes all objects with this prefix
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: string,
 *   key: string,
 *   deletedCount?: number  // Number of objects deleted (for folders)
 * }
 */
export async function DELETE(request: NextRequest) {
  // SECURITY: Only allow in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "S3 test endpoints are only available in development mode" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { key, isFolder } = body;

    if (!key) {
      return NextResponse.json(
        { error: "Missing required field: key" },
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

    if (isFolder) {
      // Delete entire folder (all objects with this prefix)
      return await deleteFolderRecursive(key);
    } else {
      // Delete single file
      return await deleteSingleFile(key);
    }
  } catch (error: any) {
    console.error("Failed to delete S3 object(s):", error);

    // Handle specific S3 errors
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return NextResponse.json(
        { error: "File or folder not found" },
        { status: 404 }
      );
    }

    if (
      error.name === "AccessDenied" ||
      error.$metadata?.httpStatusCode === 403
    ) {
      return NextResponse.json(
        { error: "Access denied - insufficient permissions" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete object(s)",
      },
      { status: 500 }
    );
  }
}
