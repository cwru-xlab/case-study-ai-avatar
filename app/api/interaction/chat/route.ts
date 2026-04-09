import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, systemPrompt, roleContext } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const styleGuide = `\n\n## Reply Style
- Speak naturally and conversationally, like a real person in a meeting or interview
- Keep responses short and to the point — 1 to 3 sentences unless more detail is truly needed
- Avoid bullet points, formal headings, or structured lists in your replies
- Never start with filler phrases like "Certainly!", "Great question!", or "Of course!"
- If you don't know something, say so simply and move on`;

    // Build system prompt from role context
    let fullSystemPrompt = systemPrompt || "You are a helpful assistant.";
    if (roleContext) {
      fullSystemPrompt = `You are playing the role of "${roleContext.roleName}" in a case study simulation.\n\n${roleContext.additionalInfo || ""}\n\n${systemPrompt || ""}`.trim();
    }
    fullSystemPrompt += styleGuide;

    const fullMessages = [
      { role: "system" as const, content: fullSystemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: fullMessages,
      max_tokens: 1000,
    });

    const responseContent = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({
      success: true,
      message: responseContent,
    });
  } catch (error) {
    console.error("Error in interaction chat:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
