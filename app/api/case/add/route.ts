import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { CaseStudy } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const caseStudy: CaseStudy = await request.json();

    if (!caseStudy.id || !caseStudy.name || !caseStudy.backgroundInfo) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, backgroundInfo" },
        { status: 400 }
      );
    }

    const exists = await s3Storage.caseExists(caseStudy.id);
    if (exists) {
      return NextResponse.json(
        { error: `Case with ID '${caseStudy.id}' already exists` },
        { status: 409 }
      );
    }

    await s3Storage.saveCase(caseStudy);

    return NextResponse.json({
      success: true,
      caseStudy,
      message: "Case created successfully",
    });
  } catch (error) {
    console.error("Case add error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create case" },
      { status: 500 }
    );
  }
}
