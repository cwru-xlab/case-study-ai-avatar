import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import { waitUntil } from "@vercel/functions";
import type { InteractionLog } from "@/types";

async function evaluateInteraction(log: InteractionLog): Promise<void> {
  try {
    // Get the case to find the evaluation prompt
    const caseData = await s3Storage.getCase(log.caseId);
    if (!caseData?.evaluationPrompt) {
      console.log(`No evaluation prompt for case ${log.caseId}, skipping evaluation`);
      return;
    }

    // Convert interaction history to text
    const interactionText = buildInteractionText(log);

    const evaluationMessages = [
      {
        role: "system" as const,
        content: caseData.evaluationPrompt,
      },
      {
        role: "user" as const,
        content: `Please evaluate the following student interaction with this case study.\n\nStudent: ${log.studentName} (${log.studentEmail})\nCase: ${log.caseName}\nAttempt: ${log.attemptNumber}\nTotal Messages: ${log.totalMessages}\nDuration: ${Math.round(log.totalTimeSeconds / 60)} minutes\n\n--- INTERACTION HISTORY ---\n${interactionText}\n--- END OF INTERACTION ---\n\nPlease provide:\n1. A score from 0-100\n2. A detailed evaluation of the student's performance\n\nFormat your response as:\nSCORE: [number]\nEVALUATION:\n[your detailed evaluation]`,
      },
    ];

    // Call OpenAI for evaluation
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: evaluationMessages,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Parse score from response
    const scoreMatch = responseText.match(/SCORE:\s*(\d+)/i);
    const evalScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : null;

    // Update the log with evaluation results
    log.evalScore = evalScore ?? undefined;
    log.evalResult = responseText;
    log.updatedAt = new Date().toISOString();

    await s3Storage.saveInteractionLog(log);
    console.log(`Evaluation completed for ${log.studentEmail} case ${log.caseId} attempt ${log.attemptNumber}: score=${evalScore}`);
  } catch (error) {
    console.error("Error evaluating interaction:", error);
    // Save the log with an error note
    log.evalResult = `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    log.updatedAt = new Date().toISOString();
    try {
      await s3Storage.saveInteractionLog(log);
    } catch {
      // Ignore secondary save errors
    }
  }
}

function buildInteractionText(log: InteractionLog): string {
  // Sort events by timestamp
  const events = [...log.events].sort((a, b) => a.timestamp - b.timestamp);

  const lines: string[] = [];
  let currentRole: string | null = null;

  for (const event of events) {
    const time = new Date(event.timestamp).toLocaleTimeString();

    switch (event.type) {
      case "start_session":
        lines.push(`[${time}] Session started`);
        break;
      case "enter_role":
        currentRole = event.roleName || event.roleId || "Unknown";
        lines.push(`\n[${time}] Student entered conversation with: ${currentRole}`);
        break;
      case "exit_role":
        lines.push(`[${time}] Student left conversation with: ${event.roleName || currentRole}`);
        currentRole = null;
        break;
      case "send_message":
        lines.push(`[${time}] Student → ${currentRole || "Unknown"}: ${event.messageContent}`);
        break;
      case "receive_message":
        lines.push(`[${time}] ${currentRole || "Unknown"} → Student: ${event.messageContent}`);
        break;
      case "end_session":
        lines.push(`\n[${time}] Session ended`);
        break;
    }
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { log } = body as { log: InteractionLog };

    if (!log || !log.id || !log.studentEmail || !log.caseId) {
      return NextResponse.json(
        { error: "Missing required interaction log data" },
        { status: 400 }
      );
    }

    const now = Date.now();

    // Add end session event
    log.events.push({
      type: "end_session",
      timestamp: now,
    });

    // Update the log
    log.status = "completed";
    log.completedAt = now;
    log.lastSavedAt = now;
    log.totalTimeSeconds = Math.round((now - log.startedAt) / 1000);
    log.updatedAt = new Date(now).toISOString();

    // Count total messages
    let totalMessages = 0;
    for (const roleInteraction of Object.values(log.roleInteractions)) {
      totalMessages += roleInteraction.messages.length;
    }
    log.totalMessages = totalMessages;

    if (log.mode === "assessed") {
      // Save immediately with status=completed
      await s3Storage.saveInteractionLog(log);

      // Use waitUntil to run evaluation in the background
      waitUntil(evaluateInteraction(log));
    }

    return NextResponse.json({
      success: true,
      message: log.mode === "assessed"
        ? "Session completed. Evaluation is being processed in the background."
        : "Explore session completed.",
      completedAt: now,
    });
  } catch (error) {
    console.error("Error finishing interaction:", error);
    return NextResponse.json(
      { error: "Failed to finish interaction" },
      { status: 500 }
    );
  }
}
