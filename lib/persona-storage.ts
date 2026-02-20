/**
 * Persona storage (client). Case Study architecture - appearance + voice only.
 * Uses /api/personas only. Does not touch /api/avatar/*.
 */

import type { Persona } from "@/types";

const api = (path: string, options?: RequestInit) =>
  fetch(path, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

export async function listPersonas(): Promise<Persona[]> {
  const res = await api("/api/personas");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = await res.json();
  return Array.isArray(data.personas) ? data.personas : [];
}

export async function getPersona(id: string): Promise<Persona | null> {
  const res = await api(`/api/personas/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = await res.json();
  return data.persona ?? null;
}

export async function createPersona(input: {
  name: string;
  professionalTitle: string;
  voiceId: string;
  voiceRate?: number;
  language?: string;
  voiceEmotion?: string;
  animationSet?: string;
}): Promise<Persona> {
  const res = await api("/api/personas", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = await res.json();
  return data.persona;
}

export async function updatePersona(
  id: string,
  updates: Partial<
    Pick<
      Persona,
      | "name"
      | "professionalTitle"
      | "avatarImageUrl"
      | "voiceId"
      | "voiceRate"
      | "language"
      | "voiceEmotion"
      | "animationSet"
    >
  >
): Promise<Persona> {
  const res = await api(`/api/personas/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = await res.json();
  return data.persona;
}

export async function deletePersona(id: string): Promise<void> {
  const res = await api(`/api/personas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function uploadPersonaImage(
  personaId: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/personas/${encodeURIComponent(personaId)}/upload-image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = await res.json();
  return data.avatarImageUrl;
}

export async function deletePersonaImage(personaId: string): Promise<void> {
  const res = await fetch(
    `/api/personas/${encodeURIComponent(personaId)}/upload-image`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}
