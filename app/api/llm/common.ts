import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMStreamResponse {
  type: "start" | "content" | "end" | "error";
  message?: string;
  content?: string;
  timestamp: string;
  metadata?: {
    model?: string;
    avatarId?: string;
    userMessage?: string;
    finalLength?: number;
    duration?: number;
  };
}

export interface LLMRequest {
  messages: ChatMessage[];
  avatarId: string;
  systemPrompt?: string; // Only for preview route
}

export function getAvatarSystemPrompt(avatarId: string): string {
  return "You are a helpful assistant. Keep your responses concise and engaging.";
}

export function createLLMStream(
  messages: ChatMessage[],
  modelName: string = "gpt-4.1"
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let accumulatedContent = "";
      const startTime = new Date().toISOString();

      try {
        // Send initial connection message with metadata
        const startMessage: LLMStreamResponse = {
          type: "start",
          message: "Connected to OpenAI stream",
          timestamp: startTime,
          metadata: {
            model: modelName,
            userMessage: messages[messages.length - 1]?.content || "No message",
          },
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(startMessage)}\n\n`)
        );

        // Call OpenAI with streaming
        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: messages,
          stream: true,
          max_tokens: 500,
        });

        // Stream the response with accumulated content
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            accumulatedContent += content;
            const contentMessage: LLMStreamResponse = {
              type: "content",
              content: accumulatedContent, // Send full accumulated content
              timestamp: new Date().toISOString(),
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(contentMessage)}\n\n`)
            );
          }
        }

        // Send completion message with end timestamp
        const endTime = new Date().toISOString();
        const endMessage: LLMStreamResponse = {
          type: "end",
          message: "Stream completed",
          timestamp: endTime,
          metadata: {
            finalLength: accumulatedContent.length,
            duration:
              new Date(endTime).getTime() - new Date(startTime).getTime(),
          },
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(endMessage)}\n\n`)
        );
      } catch (error) {
        console.error("OpenAI streaming error:", error);
        const errorMessage: LLMStreamResponse = {
          type: "error",
          message: "Failed to generate response",
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });
}

export function createSSEHeaders(): Headers {
  return new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });
}
