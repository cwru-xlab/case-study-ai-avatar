import { NextRequest, NextResponse } from "next/server";
import { ragService } from "@/lib/rag/rag-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get("avatarId");
    const isShared = searchParams.get("isShared") === "true";

    // Initialize RAG service
    await ragService.initialize();

    // Get documents for the avatar (or shared if isShared is true)
    const documents = await ragService.listDocuments(isShared ? undefined : avatarId || undefined);

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Failed to list documents:", error);

    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 },
    );
  }
}