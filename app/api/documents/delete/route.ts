import { NextRequest, NextResponse } from "next/server";

import { ragService } from "@/lib/rag/rag-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, avatarId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "Source ID is required" },
        { status: 400 },
      );
    }

    // Initialize RAG service
    await ragService.initialize();

    // Delete document
    await ragService.deleteDocument(sourceId, avatarId);

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete document:", error);

    return NextResponse.json(
      {
        error: "Failed to delete document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
