import { NextRequest, NextResponse } from "next/server";
import { demoAvatarStorage, type DemoAvatarInput } from "@/lib/demo-avatar-storage";

// GET /api/demo-avatars - List all avatars
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const published = searchParams.get("published");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    let filteredAvatars = demoAvatarStorage.getAll();

    // Filter by published status
    if (published !== null) {
      const isPublished = published === "true";
      // For demo purposes, first 6 avatars are "published"
      filteredAvatars = filteredAvatars.filter((avatar) => {
        const index = demoAvatarStorage.getIndex(avatar.id);
        return isPublished ? index < 6 : index >= 6;
      });
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAvatars = filteredAvatars.filter(
        (avatar) =>
          avatar.name.toLowerCase().includes(searchLower) ||
          avatar.description?.toLowerCase().includes(searchLower) ||
          avatar.systemPrompt.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const total = filteredAvatars.length;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : filteredAvatars.length;
    filteredAvatars = filteredAvatars.slice(offsetNum, offsetNum + limitNum);

    return NextResponse.json({
      success: true,
      avatars: filteredAvatars,
      total,
      offset: offsetNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error("Demo avatars list error:", error);
    return NextResponse.json(
      { error: "Failed to list demo avatars" },
      { status: 500 }
    );
  }
}

// POST /api/demo-avatars - Create a new avatar
export async function POST(request: NextRequest) {
  try {
    const body: DemoAvatarInput = await request.json();

    // Validate required fields
    if (!body.name || !body.systemPrompt || !body.createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: name, systemPrompt, createdBy" },
        { status: 400 }
      );
    }

    // Generate ID from name to check for duplicates
    const id = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if ID already exists
    if (demoAvatarStorage.exists(id)) {
      return NextResponse.json(
        { error: `Avatar with ID '${id}' already exists` },
        { status: 409 }
      );
    }

    const newAvatar = demoAvatarStorage.create(body);

    return NextResponse.json({
      success: true,
      avatar: newAvatar,
      message: "Avatar created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Demo avatar create error:", error);
    return NextResponse.json(
      { error: "Failed to create demo avatar" },
      { status: 500 }
    );
  }
}
