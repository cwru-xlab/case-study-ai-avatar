/**
 * Server-only HeyGen / LiveAvatar configuration.
 * Keep token endpoints and list routes aligned on the same env vars.
 */

import type { HeygenErrorCode } from "@/lib/heygen-types";

export const DEFAULT_LIVEAVATAR_API_URL = "https://api.liveavatar.com";
export const HEYGEN_REST_API_BASE = "https://api.heygen.com";

export function getHeygenApiKey(): string | undefined {
  const k = process.env.HEYGEN_API_KEY?.trim();
  return k || undefined;
}

export function getLiveAvatarApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_LIVEAVATAR_API_URL?.trim() || DEFAULT_LIVEAVATAR_API_URL
  );
}

/** Persona context for LiveAvatar session token (was previously hardcoded). */
export function getHeygenAvatarContextId(): string {
  return (
    process.env.HEYGEN_AVATAR_CONTEXT_ID?.trim() ||
    "1932d96d-3404-4081-9fec-0d967c37cd72"
  );
}

export function heygenJsonError(
  code: HeygenErrorCode,
  message: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Map LiveAvatar / HeyGen upstream failures to stable codes for the client. */
export function classifyUpstreamSessionError(
  httpStatus: number,
  message: string,
): { code: HeygenErrorCode; status: number; message: string } {
  const lower = message.toLowerCase();
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      code: "HEYGEN_INVALID_KEY",
      status: httpStatus,
      message:
        "HeyGen rejected this API key. Verify HEYGEN_API_KEY in the server environment.",
    };
  }
  if (
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key")
  ) {
    return {
      code: "HEYGEN_INVALID_KEY",
      status: httpStatus >= 400 && httpStatus < 600 ? httpStatus : 401,
      message:
        "HeyGen rejected this API key. Verify HEYGEN_API_KEY in the server environment.",
    };
  }
  return {
    code: "HEYGEN_UPSTREAM_ERROR",
    status: httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502,
    message: message || "HeyGen LiveAvatar request failed.",
  };
}
