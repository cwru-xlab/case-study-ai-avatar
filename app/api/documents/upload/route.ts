import { NextRequest, NextResponse } from "next/server";

import { ragService } from "@/lib/rag/rag-service";
import { documentProcessor } from "@/lib/rag/document-processor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const avatarId = formData.get("avatarId") as string | null;
    const isShared = formData.get("isShared") === "true";

    // Validate input
    if (!file) {
      return NextResponse.json(
        { error: "File must be provided" },
        { status: 400 },
      );
    }

    if (!isShared && !avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required for non-shared documents" },
        { status: 400 },
      );
    }

    // Initialize RAG service
    await ragService.initialize();

    // Process file upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;

    // Validate file type
    if (!documentProcessor.isSupported(mimeType)) {
      return NextResponse.json(
        {
          error: "Unsupported file type. Supported types: PDF, TXT, DOCX",
          receivedType: mimeType,
          supportedTypes: documentProcessor.getSupportedMimeTypes(),
        },
        { status: 400 },
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (buffer.length > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 },
      );
    }

    // Process document
    const processingId = await ragService.processDocument(
      {
        buffer,
        mimeType,
        filename: file.name,
        title: title || undefined,
      },
      avatarId || undefined,
      isShared,
    );

    return NextResponse.json({
      success: true,
      processingId: processingId,
      message: "Document processing started",
    });
  } catch (error) {
    console.error("Document upload error:", error);

    return NextResponse.json(
      {
        error: "Failed to process document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get("avatarId");

    // Initialize RAG service
    await ragService.initialize();

    // List documents
    const documents = await ragService.listDocuments(avatarId || undefined);

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
