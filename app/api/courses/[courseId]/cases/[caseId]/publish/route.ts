/**
 * API Route: /api/courses/[courseId]/cases/[caseId]/publish
 * 
 * Handles case publishing.
 * POST - Publish a case
 */

import { NextRequest, NextResponse } from "next/server";
import { caseStorage } from "@/lib/case-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; caseId: string }> }
) {
  try {
    const { courseId, caseId } = await params;
    
    const caseData = await caseStorage.getCase(courseId, caseId);
    if (!caseData) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Validate case is ready for publishing
    const validationErrors: string[] = [];
    
    if (!caseData.name) {
      validationErrors.push("Case must have a name");
    }
    
    if (caseData.nodes.length < 2) {
      validationErrors.push("Case must have at least 2 nodes (opening and ending)");
    }
    
    if (!caseData.startNodeId) {
      validationErrors.push("Case must have a start node");
    }
    
    const hasEnding = caseData.nodes.some(n => n.type === "ending");
    if (!hasEnding) {
      validationErrors.push("Case must have an ending node");
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Case is not ready for publishing", validationErrors },
        { status: 400 }
      );
    }

    const published = await caseStorage.publishCase(courseId, caseId);

    return NextResponse.json({ case: published });
  } catch (error) {
    console.error("Error publishing case:", error);
    return NextResponse.json(
      { error: "Failed to publish case" },
      { status: 500 }
    );
  }
}
