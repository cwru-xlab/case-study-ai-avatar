import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Avatar } from "@/lib/avatar-storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/demo-avatars/[id] - Get a single avatar from S3
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const avatar = await s3Storage.getAvatar(id);

    if (!avatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Get published status from manifest
    const manifest = await s3Storage.getVersionManifest();
    const isPublished = manifest.avatars[id]?.published || false;

    return NextResponse.json({
      success: true,
      avatar: {
        ...avatar,
        published: isPublished,
      },
    });
  } catch (error) {
    console.error("Demo avatar get error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error - check AWS credentials" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to get avatar" },
      { status: 500 }
    );
  }
}

// PUT /api/demo-avatars/[id] - Update an avatar (full update) in S3
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate required fields for full update
    if (!body.name || !body.systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, systemPrompt" },
        { status: 400 }
      );
    }

    const existingAvatar = await s3Storage.getAvatar(id);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const updatedAvatar: Avatar = {
      ...existingAvatar,
      name: body.name,
      systemPrompt: body.systemPrompt,
      description: body.description,
      lastEditedBy: body.lastEditedBy || existingAvatar.lastEditedBy,
      lastEditedAt: new Date().toISOString(),
      published: body.published !== undefined ? body.published : existingAvatar.published,
      // Case authoring fields
      scenarioNodes: body.scenarioNodes !== undefined ? body.scenarioNodes : existingAvatar.scenarioNodes,
      scenarioEdges: body.scenarioEdges !== undefined ? body.scenarioEdges : existingAvatar.scenarioEdges,
      startNodeId: body.startNodeId !== undefined ? body.startNodeId : existingAvatar.startNodeId,
      learningObjectives: body.learningObjectives !== undefined ? body.learningObjectives : existingAvatar.learningObjectives,
      difficulty: body.difficulty !== undefined ? body.difficulty : existingAvatar.difficulty,
      estimatedDuration: body.estimatedDuration !== undefined ? body.estimatedDuration : existingAvatar.estimatedDuration,
      caseContext: body.caseContext !== undefined ? body.caseContext : existingAvatar.caseContext,
      personalityTraits: body.personalityTraits !== undefined ? body.personalityTraits : existingAvatar.personalityTraits,
      guardrails: body.guardrails !== undefined ? body.guardrails : existingAvatar.guardrails,
    };

    const version = await s3Storage.saveAvatar(updatedAvatar);

    return NextResponse.json({
      success: true,
      avatar: updatedAvatar,
      version,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("Demo avatar update error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error - check AWS credentials" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to update avatar" },
      { status: 500 }
    );
  }
}

// PATCH /api/demo-avatars/[id] - Partial update an avatar in S3
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingAvatar = await s3Storage.getAvatar(id);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Only update provided fields
    const updatedAvatar: Avatar = {
      ...existingAvatar,
      lastEditedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updatedAvatar.name = body.name;
    if (body.systemPrompt !== undefined) updatedAvatar.systemPrompt = body.systemPrompt;
    if (body.description !== undefined) updatedAvatar.description = body.description;
    if (body.lastEditedBy !== undefined) updatedAvatar.lastEditedBy = body.lastEditedBy;
    if (body.published !== undefined) updatedAvatar.published = body.published;
    // Case authoring fields
    if (body.scenarioNodes !== undefined) updatedAvatar.scenarioNodes = body.scenarioNodes;
    if (body.scenarioEdges !== undefined) updatedAvatar.scenarioEdges = body.scenarioEdges;
    if (body.startNodeId !== undefined) updatedAvatar.startNodeId = body.startNodeId;
    if (body.learningObjectives !== undefined) updatedAvatar.learningObjectives = body.learningObjectives;
    if (body.difficulty !== undefined) updatedAvatar.difficulty = body.difficulty;
    if (body.estimatedDuration !== undefined) updatedAvatar.estimatedDuration = body.estimatedDuration;
    if (body.caseContext !== undefined) updatedAvatar.caseContext = body.caseContext;
    if (body.personalityTraits !== undefined) updatedAvatar.personalityTraits = body.personalityTraits;
    if (body.guardrails !== undefined) updatedAvatar.guardrails = body.guardrails;

    const version = await s3Storage.saveAvatar(updatedAvatar);

    return NextResponse.json({
      success: true,
      avatar: updatedAvatar,
      version,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("Demo avatar patch error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error - check AWS credentials" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to update avatar" },
      { status: 500 }
    );
  }
}

// DELETE /api/demo-avatars/[id] - Delete an avatar from S3
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const exists = await s3Storage.avatarExists(id);
    if (!exists) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    await s3Storage.deleteAvatar(id);

    return NextResponse.json({
      success: true,
      id,
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    console.error("Demo avatar delete error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error - check AWS credentials" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
