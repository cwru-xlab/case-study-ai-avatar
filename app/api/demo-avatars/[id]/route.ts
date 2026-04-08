import { NextRequest, NextResponse } from "next/server";
import { demoAvatarStorage, type DemoAvatarUpdate } from "@/lib/demo-avatar-storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/demo-avatars/[id] - Get a single avatar
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const avatar = demoAvatarStorage.getById(id);

    if (!avatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Determine published status (first 6 are published in demo)
    const avatarIndex = demoAvatarStorage.getIndex(id);
    const isPublished = avatarIndex < 6;

    return NextResponse.json({
      success: true,
      avatar: {
        ...avatar,
        published: isPublished,
      },
    });
  } catch (error) {
    console.error("Demo avatar get error:", error);
    return NextResponse.json(
      { error: "Failed to get demo avatar" },
      { status: 500 }
    );
  }
}

// PUT /api/demo-avatars/[id] - Update an avatar (full update)
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

    const existingAvatar = demoAvatarStorage.getById(id);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const updates: DemoAvatarUpdate = {
      name: body.name,
      systemPrompt: body.systemPrompt,
      description: body.description,
      lastEditedBy: body.lastEditedBy || existingAvatar.lastEditedBy,
    };

    const updatedAvatar = demoAvatarStorage.update(id, updates);

    return NextResponse.json({
      success: true,
      avatar: updatedAvatar,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("Demo avatar update error:", error);
    return NextResponse.json(
      { error: "Failed to update demo avatar" },
      { status: 500 }
    );
  }
}

// PATCH /api/demo-avatars/[id] - Partial update an avatar
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingAvatar = demoAvatarStorage.getById(id);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Only update provided fields
    const updates: DemoAvatarUpdate = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt;
    if (body.description !== undefined) updates.description = body.description;
    if (body.lastEditedBy !== undefined) updates.lastEditedBy = body.lastEditedBy;

    const updatedAvatar = demoAvatarStorage.update(id, updates);

    return NextResponse.json({
      success: true,
      avatar: updatedAvatar,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("Demo avatar patch error:", error);
    return NextResponse.json(
      { error: "Failed to update demo avatar" },
      { status: 500 }
    );
  }
}

// DELETE /api/demo-avatars/[id] - Delete an avatar
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const existingAvatar = demoAvatarStorage.getById(id);
    if (!existingAvatar) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const deleted = demoAvatarStorage.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete avatar" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    console.error("Demo avatar delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete demo avatar" },
      { status: 500 }
    );
  }
}
