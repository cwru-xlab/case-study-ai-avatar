import { NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET() {
  try {
    const cases = await s3Storage.listCases();

    return NextResponse.json({
      success: true,
      cases,
      message: "Cases retrieved successfully",
    });
  } catch (error) {
    console.error("Case list error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to list cases" },
      { status: 500 }
    );
  }
}
