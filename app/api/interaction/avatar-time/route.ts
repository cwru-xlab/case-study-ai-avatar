import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { InteractionEvent } from "@/types";

function calcAvatarSeconds(events: InteractionEvent[], lastSavedAt?: number): number {
  let total = 0;
  let avatarStart: number | null = null;
  for (const event of events) {
    if (event.type === "switch_interaction_mode") {
      if (event.interactionMode === "avatar") {
        avatarStart = event.timestamp;
      } else if (avatarStart !== null) {
        total += event.timestamp - avatarStart;
        avatarStart = null;
      }
    } else if (event.type === "end_session" && avatarStart !== null) {
      total += event.timestamp - avatarStart;
      avatarStart = null;
    }
  }
  // If avatar mode was still active when the log was last saved (no closing event),
  // count time up to lastSavedAt or the last event timestamp
  if (avatarStart !== null) {
    const closeTime = lastSavedAt ?? events[events.length - 1]?.timestamp ?? avatarStart;
    total += closeTime - avatarStart;
  }
  return Math.round(total / 1000);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentEmail = searchParams.get("studentEmail");
    const caseId = searchParams.get("caseId");

    if (!studentEmail || !caseId) {
      return NextResponse.json(
        { error: "studentEmail and caseId are required" },
        { status: 400 }
      );
    }

    const logIndex = await s3Storage.listInteractionLogs(studentEmail, caseId);
    let totalSeconds = 0;

    for (const entry of logIndex) {
      const log = await s3Storage.getInteractionLog(studentEmail, caseId, entry.id);
      if (log?.events) {
        totalSeconds += calcAvatarSeconds(log.events, log.lastSavedAt);
      }
    }

    return NextResponse.json({
      usedSeconds: totalSeconds,
      usedMinutes: Math.round((totalSeconds / 60) * 10) / 10,
    });
  } catch (error) {
    console.error("Error calculating avatar time:", error);
    return NextResponse.json(
      { error: "Failed to calculate avatar time" },
      { status: 500 }
    );
  }
}
