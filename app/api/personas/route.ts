import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import { getSeedPersonas } from "@/lib/personas-seed";
import type { Persona } from "@/types";

export async function GET() {
  try {
    let personas = await s3Storage.listPersonas();
    if (personas.length === 0) {
      const seed = getSeedPersonas();
      for (const p of seed) {
        await s3Storage.savePersona(p);
      }
      personas = await s3Storage.listPersonas();
    }
    return NextResponse.json({ success: true, personas });
  } catch (error) {
    console.error("Personas list error:", error);
    return NextResponse.json(
      { error: "Failed to list personas" },
      { status: 500 }
    );
  }
}

function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      professionalTitle,
      voiceId,
      voiceRate = 1.0,
      language = "en",
      voiceEmotion,
      animationSet,
    } = body;
    if (!name?.trim() || !professionalTitle?.trim() || !voiceId?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: name, professionalTitle, voiceId" },
        { status: 400 }
      );
    }
    const id = toId(name.trim());
    if (id === "new") {
      return NextResponse.json(
        { error: "Name cannot generate id 'new'" },
        { status: 400 }
      );
    }
    const existing = await s3Storage.getPersona(id);
    if (existing) {
      return NextResponse.json(
        { error: `Persona with id '${id}' already exists` },
        { status: 409 }
      );
    }
    const now = new Date().toISOString();
    const persona: Persona = {
      id,
      name: name.trim(),
      professionalTitle: professionalTitle.trim(),
      avatarImageUrl: body.avatarImageUrl,
      voiceId: voiceId.trim(),
      voiceRate: Number(voiceRate) || 1.0,
      language: (language || "en").trim().toLowerCase(),
      voiceEmotion: voiceEmotion?.trim() || undefined,
      animationSet: animationSet?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await s3Storage.savePersona(persona);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error("Persona create error:", error);
    return NextResponse.json(
      { error: "Failed to create persona" },
      { status: 500 }
    );
  }
}
