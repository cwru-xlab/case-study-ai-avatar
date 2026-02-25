import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Avatar } from "@/lib/avatar-storage";

// GET /api/demo-avatars - List all avatars from S3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const published = searchParams.get("published");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Fetch all avatars from S3
    let avatars = await s3Storage.listAllAvatars();

    // Get version manifest for published status
    const manifest = await s3Storage.getVersionManifest();

    // Enrich avatars with published status from manifest
    avatars = avatars.map((avatar) => ({
      ...avatar,
      published: manifest.avatars[avatar.id]?.published || false,
    }));

    // Filter by published status
    if (published !== null) {
      const isPublished = published === "true";
      avatars = avatars.filter((avatar) => avatar.published === isPublished);
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      avatars = avatars.filter(
        (avatar) =>
          avatar.name.toLowerCase().includes(searchLower) ||
          avatar.description?.toLowerCase().includes(searchLower) ||
          avatar.systemPrompt.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const total = avatars.length;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : avatars.length;
    avatars = avatars.slice(offsetNum, offsetNum + limitNum);

    return NextResponse.json({
      success: true,
      avatars,
      total,
      offset: offsetNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error("Demo avatars list error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error - check AWS credentials" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to list avatars" },
      { status: 500 }
    );
  }
}

// POST /api/demo-avatars - Create a new avatar in S3
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.systemPrompt || !body.createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: name, systemPrompt, createdBy" },
        { status: 400 }
      );
    }

    // Generate ID from name
    const id = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if avatar already exists
    const exists = await s3Storage.avatarExists(id);
    if (exists) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' already exists` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newAvatar: Avatar = {
      id,
      name: body.name,
      systemPrompt: body.systemPrompt,
      description: body.description,
      createdBy: body.createdBy,
      lastEditedBy: body.createdBy,
      createdAt: now,
      lastEditedAt: now,
      published: body.published || false,
      conversationStarters: body.conversationStarters || [],
    };

    // Save to S3
    const version = await s3Storage.saveAvatar(newAvatar);

    return NextResponse.json({
      success: true,
      avatar: newAvatar,
      version,
      message: "Avatar created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Demo avatar create error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "S3 configuration error - check AWS credentials" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to create avatar" },
      { status: 500 }
    );
  }
}
