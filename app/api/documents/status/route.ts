import { NextRequest, NextResponse } from "next/server";

import { ragService } from "@/lib/rag/rag-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processingId = searchParams.get("processingId");

    if (!processingId) {
      return NextResponse.json(
        { error: "Processing ID is required" },
        { status: 400 },
      );
    }

    // Get processing status
    const status = await ragService.getProcessingStatus(processingId);

    if (!status) {
      return NextResponse.json(
        { error: "Processing ID not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("Failed to get processing status:", error);

    return NextResponse.json(
      { error: "Failed to get processing status" },
      { status: 500 },
    );
  }
}
