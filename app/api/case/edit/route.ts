import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { CaseStudy } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { id, caseStudy } = (await request.json()) as {
      id: string;
      caseStudy: Partial<CaseStudy>;
    };

    if (!id || !caseStudy) {
      return NextResponse.json(
        { error: "Missing required fields: id, caseStudy" },
        { status: 400 }
      );
    }

    const existing = await s3Storage.getCase(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Case with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const updatedCase: CaseStudy = {
      ...existing,
      ...caseStudy,
      id,
      lastEditedAt: new Date().toISOString(),
    };

    await s3Storage.saveCase(updatedCase);

    return NextResponse.json({
      success: true,
      caseStudy: updatedCase,
      message: "Case updated successfully",
    });
  } catch (error) {
    console.error("Case edit error:", error);

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update case" },
      { status: 500 }
    );
  }
}
