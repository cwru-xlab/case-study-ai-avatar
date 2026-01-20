import { NextRequest, NextResponse } from "next/server";
import {
  createLLMStream,
  createSSEHeaders,
  type LLMRequest,
  type ChatMessage,
} from "../common";
import { ragService } from "@/lib/rag/rag-service";
import { applyGuardrails, getBlockedContentResponse } from "@/lib/guardrails";

export async function POST(request: NextRequest) {
  try {
    const body: LLMRequest = await request.json();
    const { messages, avatarId, systemPrompt } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (!avatarId) {
      return NextResponse.json(
        { error: "Avatar ID is required" },
        { status: 400 }
      );
    }

    if (!systemPrompt) {
      return NextResponse.json(
        { error: "System prompt is required for preview route" },
        { status: 400 }
      );
    }

    // Get the user's latest message for RAG search
    const userMessages = messages.filter((msg) => msg.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1];
    console.log("received API call for preview route", new Date().toISOString());

    // Apply guardrails check
    const guardrailsResult = await applyGuardrails(
      systemPrompt,
      latestUserMessage?.content || ""
    );

    console.log("guardrailsResult", guardrailsResult, new Date().toISOString());
    if (!guardrailsResult.allowed) {
      // Return blocked content response directly as SSE stream
      const blockedResponse = await getBlockedContentResponse();
      const headers = createSSEHeaders();
      
      const stream = new ReadableStream({
        start(controller) {
          // Send the blocked response as content
          controller.enqueue(`data: ${JSON.stringify({ type: "content", content: blockedResponse })}\n\n`);
          // Send end signal
          controller.enqueue(`data: ${JSON.stringify({ type: "end" })}\n\n`);
          controller.close();
        }
      });
      
      return new Response(stream, { headers });
    }

    // Initialize RAG service
    await ragService.initialize();

    // Search knowledge base for relevant context
    const ragContext = await ragService.searchKnowledgeBase(
      latestUserMessage?.content || "",
      avatarId,
    );

    // Build enhanced system prompt with RAG context
    let enhancedSystemPrompt = guardrailsResult.enhancedPrompt;

    if (ragContext.chunks.length > 0) {
      const contextText = ragContext.chunks
        .map(
          (chunk, index) =>
            `[Source ${index + 1}: ${chunk.source}]\n${chunk.text}\n`,
        )
        .join("\n");

      const sourcesList = ragContext.sources.join(", ");

      enhancedSystemPrompt += `\n\n## Knowledge Base Context\n\nYou have access to the following relevant information from your knowledge base:\n\n${contextText}\n\nSources: ${sourcesList}\n\nWhen answering questions, you should prioritize information from your knowledge base when relevant. If you reference specific information from the knowledge base, you can mention the source.`;
    }

    // Prepare messages with enhanced system prompt
    const fullMessages: ChatMessage[] = [
      { role: "system", content: enhancedSystemPrompt },
      ...messages.filter((msg) => msg.role !== "system"), // Remove any existing system messages
    ];

    // Create and return the stream
    const stream = createLLMStream(fullMessages);
    const headers = createSSEHeaders();

    return new Response(stream, { headers });
  } catch (error) {
    console.error("Preview API Error:", error);
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }
}
