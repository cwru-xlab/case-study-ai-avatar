import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;
    if (!personaId) {
      return NextResponse.json({ error: "Missing persona id" }, { status: 400 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG and PNG allowed." },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_SIZE_MB}MB.` },
        { status: 400 }
      );
    }
    const persona = await s3Storage.getPersona(personaId);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    const publicUrl = await s3Storage.uploadPersonaImage(personaId, file);
    persona.avatarImageUrl = publicUrl;
    persona.updatedAt = new Date().toISOString();
    await s3Storage.savePersona(persona);
    return NextResponse.json({
      success: true,
      avatarImageUrl: publicUrl,
    });
  } catch (error) {
    console.error("Persona image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload persona image" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;
    if (!personaId) {
      return NextResponse.json({ error: "Missing persona id" }, { status: 400 });
    }
    const persona = await s3Storage.getPersona(personaId);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    await s3Storage.deletePersonaImage(personaId);
    persona.avatarImageUrl = undefined;
    persona.updatedAt = new Date().toISOString();
    await s3Storage.savePersona(persona);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Persona image delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete persona image" },
      { status: 500 }
    );
  }
}
