import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing case ID parameter" },
        { status: 400 }
      );
    }

    const caseStudy = await s3Storage.getCase(id);

    if (!caseStudy) {
      return NextResponse.json(
        { error: `Case with ID '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      caseStudy,
      message: "Case retrieved successfully",
    });
  } catch (error) {
    console.error("Case get error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to retrieve case" },
      { status: 500 }
    );
  }
}
