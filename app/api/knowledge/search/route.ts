import { NextRequest, NextResponse } from "next/server";

import { ragService } from "@/lib/rag/rag-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, avatarId, topK = 5 } = body;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (typeof query !== "string") {
      return NextResponse.json(
        { error: "Query must be a string" },
        { status: 400 },
      );
    }

    // Initialize RAG service
    await ragService.initialize();

    // Search knowledge base
    const context = await ragService.searchKnowledgeBase(query, avatarId, topK);

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (error) {
    console.error("Knowledge search error:", error);

    return NextResponse.json(
      {
        error: "Failed to search knowledge base",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
