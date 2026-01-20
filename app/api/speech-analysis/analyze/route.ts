import { NextRequest, NextResponse } from "next/server";
import {
  speechAnalysisService,
  type SpeechAnalysisRequest,
} from "@/lib/speech-analysis";
import { documentProcessor } from "@/lib/rag/document-processor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const avatarId = formData.get("avatarId") as string;

    if (!avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required" },
        { status: 400 },
      );
    }

    // Process uploaded files
    const files: SpeechAnalysisRequest["files"] = [];
    const fileEntries = formData.getAll("files");
    const reset = formData.get("reset") as string;

    if (fileEntries.length === 0 && !reset) {
      return NextResponse.json(
        { error: "At least one file (transcript or audio) is required" },
        { status: 400 },
      );
    }

    // Handle reset request - revert to original system prompt
    if (reset === "true") {
      try {
        const { s3Storage } = require("@/lib/s3-client");
        const existingAvatar = await s3Storage.getAvatar(avatarId);
        if (!existingAvatar) {
          return NextResponse.json(
            { error: "Avatar not found" },
            { status: 404 },
          );
        }

        // Remove all speech analysis data
        const updatedAvatar = {
          ...existingAvatar,
          speechAnalysis: null,
          speechPromptAddition: null,
          speechSourceFiles: [],
          // Keep base system prompt, just remove speech pattern section
          systemPrompt: existingAvatar.originalSystemPrompt || existingAvatar.systemPrompt.split("\n\n## SPEECH PATTERN")[0],
          lastEditedAt: new Date().toISOString(),
        };

        await s3Storage.saveAvatar(updatedAvatar);
        return NextResponse.json({
          success: true,
          message: "Successfully reset avatar speech patterns",
        });
      } catch (error) {
        console.error("Failed to reset avatar:", error);
        return NextResponse.json(
          { error: "Failed to reset avatar speech patterns" },
          { status: 500 },
        );
      }
    }

    for (const entry of fileEntries) {
      if (entry instanceof File) {
        const file = entry as File;
        const isAudioFile = file.type.startsWith("audio/");
        const isTextFile =
          file.type === "text/plain" || file.name.endsWith(".txt");
        const isPdfFile = 
          file.type === "application/pdf" || file.name.endsWith(".pdf");

        if (!isAudioFile && !isTextFile && !isPdfFile) {
          return NextResponse.json(
            {
              error: `Unsupported file type: ${file.type}. Supported types: audio files (mp3, wav, m4a), text files (.txt), and PDF files`,
              fileName: file.name,
            },
            { status: 400 },
          );
        }

        // Validate file size (100MB limit for audio, 10MB for text/PDF)
        const maxSize = isAudioFile ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          return NextResponse.json(
            {
              error: `File too large: ${file.name}. Maximum size: ${isAudioFile ? "100MB" : "10MB"}`,
              fileName: file.name,
            },
            { status: 400 },
          );
        }

        if (isTextFile) {
          // Handle transcript files
          const textContent = await file.text();
          files.push({
            name: file.name,
            type: "transcript",
            content: textContent,
          });
        } else if (isPdfFile) {
          // Handle PDF files - extract text content
          try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const extractedText = await documentProcessor.extractTextFromPDF(buffer);
            files.push({
              name: file.name,
              type: "transcript", // Treat PDF as transcript after text extraction
              content: extractedText,
            });
          } catch (error) {
            return NextResponse.json(
              {
                error: `Failed to extract text from PDF: ${file.name}. ${error instanceof Error ? error.message : "Unknown error"}`,
                fileName: file.name,
              },
              { status: 500 },
            );
          }
        } else if (isAudioFile) {
          // Handle audio files
          const arrayBuffer = await file.arrayBuffer();
          const base64Content = Buffer.from(arrayBuffer).toString("base64");
          files.push({
            name: file.name,
            type: "audio",
            content: base64Content,
          });
        }
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No valid files found to process" },
        { status: 400 },
      );
    }

    // Process the speech analysis
    const analysisRequest: SpeechAnalysisRequest = {
      avatarId,
      files,
    };

    // Get existing avatar to check for original system prompt
    const { s3Storage } = require("@/lib/s3-client");
    const existingAvatar = await s3Storage.getAvatar(avatarId);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: "Avatar not found" },
        { status: 404 },
      );
    }

    // Store original system prompt if not already stored
    if (!existingAvatar.originalSystemPrompt) {
      existingAvatar.originalSystemPrompt = existingAvatar.systemPrompt;
      await s3Storage.saveAvatar(existingAvatar);
    }

    console.log("Processing speech analysis request:", {
      avatarId,
      fileCount: files.length,
      fileTypes: files.map(f => f.type),
      totalContentLength: files.reduce((sum, f) => sum + f.content.length, 0)
    });

    const analysis = await speechAnalysisService.processFiles(analysisRequest);

    // Generate system prompt addition
    const systemPromptAddition =
      speechAnalysisService.generateSystemPromptAddition(analysis);

    // Update the avatar with the speech analysis
    try {
      console.log("Attempting to update avatar with speech analysis...");
      // We already have existingAvatar from earlier
      // Already checked avatar existence above
      {
        // Prepare source files metadata
        const speechSourceFiles = files.map(file => ({
          name: file.name,
          type: file.type as "audio" | "transcript" | "pdf",
          uploadedAt: new Date().toISOString(),
        }));

        // Check if the speech prompt addition is already in the system prompt
        const promptAlreadyExists = existingAvatar.systemPrompt.includes(systemPromptAddition);
        
        // Store original system prompt if this is first speech analysis
        const originalSystemPrompt = !existingAvatar.originalSystemPrompt 
          ? existingAvatar.systemPrompt 
          : existingAvatar.originalSystemPrompt;

        // Update avatar with speech analysis, avoiding duplicates
        const updatedAvatar = {
          ...existingAvatar,
          originalSystemPrompt, // Store original prompt for restoration
          speechAnalysis: analysis,
          speechPromptAddition: systemPromptAddition,
          speechSourceFiles: [...(existingAvatar.speechSourceFiles || []), ...speechSourceFiles],
          systemPrompt: promptAlreadyExists 
            ? existingAvatar.systemPrompt 
            : existingAvatar.systemPrompt + "\n\n" + systemPromptAddition,
          lastEditedAt: new Date().toISOString(),
        };

        // Save the updated avatar
        await s3Storage.saveAvatar(updatedAvatar);
        
        console.log("Avatar updated with speech analysis successfully");
      }
    } catch (avatarUpdateError) {
      console.error("Failed to update avatar:", avatarUpdateError);
      // Don't fail the whole request if avatar update fails
      // The analysis was successful, we just couldn't save it to the avatar
      console.log("Continuing with response despite avatar update failure");
    }

    return NextResponse.json({
      success: true,
      analysis,
      systemPromptAddition,
      message: `Successfully analyzed ${files.length} file(s) for speech patterns`,
    });
  } catch (error) {
    console.error("Speech analysis API error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
      type: typeof error,
      error: error
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("Insufficient content")) {
        return NextResponse.json(
          {
            error:
              "Insufficient content for analysis. Please provide longer transcripts or audio files.",
          },
          { status: 400 },
        );
      }

      if (error.message.includes("transcription failed")) {
        return NextResponse.json(
          {
            error:
              "Failed to transcribe audio files. Please ensure they are in a supported format.",
          },
          { status: 500 },
        );
      }

      if (error.message.includes("analysis failed") || error.message.includes("OpenAI")) {
        return NextResponse.json(
          {
            error:
              "Failed to analyze speech patterns. This may be due to insufficient content, OpenAI API issues, or content format problems. Please try again or contact support.",
            details: error.message,
            debugInfo: {
              errorType: error.constructor.name,
              timestamp: new Date().toISOString()
            }
          },
          { status: 500 },
        );
      }

      if (error.message.includes("parse") || error.message.includes("JSON")) {
        return NextResponse.json(
          {
            error:
              "Failed to parse speech analysis response. The analysis may have completed but couldn't be processed properly.",
            details: error.message,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to process speech analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET endpoint to retrieve existing analyses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get("avatarId");
    const analysisId = searchParams.get("analysisId");

    if (!avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required" },
        { status: 400 },
      );
    }

    if (analysisId) {
      // Get specific analysis
      const analysis = await speechAnalysisService.getStoredAnalysis(
        avatarId,
        analysisId,
      );

      if (!analysis) {
        return NextResponse.json(
          { error: "Analysis not found" },
          { status: 404 },
        );
      }

      const systemPromptAddition =
        speechAnalysisService.generateSystemPromptAddition(analysis);

      return NextResponse.json({
        success: true,
        analysis,
        systemPromptAddition,
      });
    } else {
      // List all analyses for avatar
      const analyses =
        await speechAnalysisService.listAnalysesForAvatar(avatarId);

      return NextResponse.json({
        success: true,
        analyses,
        count: analyses.length,
      });
    }
  } catch (error) {
    console.error("Speech analysis retrieval error:", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve speech analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// DELETE endpoint to remove speech analysis
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get("avatarId");

    if (!avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required" },
        { status: 400 },
      );
    }

    // Same logic as reset=true in POST
    const { s3Storage } = require("@/lib/s3-client");
    const existingAvatar = await s3Storage.getAvatar(avatarId);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: "Avatar not found" },
        { status: 404 },
      );
    }

    // Remove all speech analysis data
    const updatedAvatar = {
      ...existingAvatar,
      speechAnalysis: null,
      speechPromptAddition: null,
      speechSourceFiles: [],
      // Revert to original system prompt or remove speech pattern section
      systemPrompt: existingAvatar.originalSystemPrompt || existingAvatar.systemPrompt.split("\n\n## SPEECH PATTERN")[0] || existingAvatar.systemPrompt.split("\n\n## PERSONAL SPEECH PATTERN")[0],
      lastEditedAt: new Date().toISOString(),
    };

    await s3Storage.saveAvatar(updatedAvatar);
    return NextResponse.json({
      success: true,
      message: "Successfully removed speech analysis from avatar",
    });
  } catch (error) {
    console.error("Failed to remove speech analysis:", error);
    return NextResponse.json(
      { error: "Failed to remove speech analysis from avatar" },
      { status: 500 },
    );
  }
}
