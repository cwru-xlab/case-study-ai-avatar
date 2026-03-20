import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { InteractionLog } from "@/types";

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

    // Only save assessed mode interactions
    if (log.mode !== "assessed") {
      return NextResponse.json({
        success: true,
        message: "Explore mode - not saving to S3",
      });
    }

    // Update timestamps
    const now = Date.now();
    log.lastSavedAt = now;
    log.updatedAt = new Date(now).toISOString();
    log.totalTimeSeconds = Math.round((now - log.startedAt) / 1000);

    // Count total messages across all role interactions
    let totalMessages = 0;
    for (const roleInteraction of Object.values(log.roleInteractions)) {
      totalMessages += roleInteraction.messages.length;
    }
    log.totalMessages = totalMessages;

    await s3Storage.saveInteractionLog(log);

    return NextResponse.json({
      success: true,
      message: "Interaction log saved",
      lastSavedAt: now,
    });
  } catch (error) {
    console.error("Error saving interaction:", error);
    return NextResponse.json(
      { error: "Failed to save interaction" },
      { status: 500 }
    );
  }
}
