import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSSEHeaders } from "../../llm/common";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionStreamResponse {
  type: "start" | "delta" | "done" | "error";
  delta?: string;
  text?: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let accumulatedText = "";

        try {
          // Send start message
          const startMessage: TranscriptionStreamResponse = {
            type: "start",
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(startMessage)}\n\n`)
          );

          // Create real streaming transcription
          const transcriptionStream = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "gpt-4o-transcribe",
            stream: true,
          });

          // Handle real stream events
          for await (const event of transcriptionStream) {
            console.log(event);

            if (event.type === "transcript.text.delta") {
              // Add the delta to accumulated text
              accumulatedText += event.delta;

              const deltaMessage: TranscriptionStreamResponse = {
                type: "delta",
                delta: event.delta,
                text: accumulatedText,
                timestamp: new Date().toISOString(),
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(deltaMessage)}\n\n`)
              );
            } else if (event.type === "transcript.text.done") {
              // Final complete text
              const finalText = event.text;

              const doneMessage: TranscriptionStreamResponse = {
                type: "done",
                text: finalText,
                timestamp: new Date().toISOString(),
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(doneMessage)}\n\n`)
              );
              break;
            }
          }

        } catch (error) {
          console.error("Transcription error:", error);
          const errorMessage: TranscriptionStreamResponse = {
            type: "error",
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

    return new Response(stream, {
      headers: createSSEHeaders(),
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 }
    );
  }
} 