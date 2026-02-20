import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { Persona } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const persona = await s3Storage.getPersona(id);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error("Persona get error:", error);
    return NextResponse.json(
      { error: "Failed to get persona" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const existing = await s3Storage.getPersona(id);
    if (!existing) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    const body = await request.json();
    const updatedAt = new Date().toISOString();
    const persona: Persona = {
      ...existing,
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      professionalTitle:
        body.professionalTitle !== undefined
          ? String(body.professionalTitle).trim()
          : existing.professionalTitle,
      avatarImageUrl: body.avatarImageUrl !== undefined ? body.avatarImageUrl : existing.avatarImageUrl,
      voiceId: body.voiceId !== undefined ? String(body.voiceId).trim() : existing.voiceId,
      voiceRate: body.voiceRate !== undefined ? Number(body.voiceRate) || 1.0 : existing.voiceRate,
      language: body.language !== undefined ? String(body.language).trim().toLowerCase() : existing.language,
      voiceEmotion: body.voiceEmotion !== undefined ? (body.voiceEmotion?.trim() || undefined) : existing.voiceEmotion,
      animationSet: body.animationSet !== undefined ? (body.animationSet?.trim() || undefined) : existing.animationSet,
      updatedAt,
    };
    await s3Storage.savePersona(persona);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error("Persona update error:", error);
    return NextResponse.json(
      { error: "Failed to update persona" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const existing = await s3Storage.getPersona(id);
    if (!existing) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    await s3Storage.deletePersona(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Persona delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete persona" },
      { status: 500 }
    );
  }
}
