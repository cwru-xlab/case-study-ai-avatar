import type { Persona } from "@/types";

const now = new Date().toISOString();

/** Default seed personas. Each has unique placeholder voiceId, language "en", voiceRate 1.0 */
export const SEED_PERSONAS: Omit<Persona, "createdAt" | "updatedAt">[] = [
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    professionalTitle: "Chief Executive Officer",
    voiceId: "sarah-chen-voice-001",
    voiceRate: 1.0,
    language: "en",
    animationSet: "default",
  },
  {
    id: "marcus-rodriguez",
    name: "Marcus Rodriguez",
    professionalTitle: "Chief Financial Officer",
    voiceId: "marcus-rodriguez-voice-002",
    voiceRate: 1.0,
    language: "en",
    animationSet: "default",
  },
  {
    id: "dr-emily-watson",
    name: "Dr. Emily Watson",
    professionalTitle: "Chief Technology Officer",
    voiceId: "dr-emily-watson-voice-003",
    voiceRate: 1.0,
    language: "en",
    animationSet: "default",
  },
  {
    id: "linda-park",
    name: "Linda Park",
    professionalTitle: "Chief Operating Officer",
    voiceId: "linda-park-voice-004",
    voiceRate: 1.0,
    language: "en",
    animationSet: "default",
  },
  {
    id: "david-kim",
    name: "David Kim",
    professionalTitle: "Chief Marketing Officer",
    voiceId: "david-kim-voice-005",
    voiceRate: 1.0,
    language: "en",
    animationSet: "default",
  },
];

export function getSeedPersonas(): Persona[] {
  return SEED_PERSONAS.map((p) => ({
    ...p,
    createdAt: now,
    updatedAt: now,
  }));
}
