/**
 * Client-safe HeyGen error helpers (no server secrets).
 */

import type { HeygenErrorCode } from "@/lib/heygen-types";

export class HeygenSessionError extends Error {
  readonly code?: HeygenErrorCode;

  constructor(message: string, code?: HeygenErrorCode) {
    super(message);
    this.name = "HeygenSessionError";
    this.code = code;
  }
}

export const HEYGEN_ERROR_USER_MESSAGES: Record<HeygenErrorCode, string> = {
  HEYGEN_MISSING_KEY:
    "Avatar mode is unavailable: the server has no HeyGen API key. Add HEYGEN_API_KEY to the server environment (see .env.template).",
  HEYGEN_INVALID_KEY:
    "Avatar mode failed: HeyGen rejected the API key. Ask your admin to set a valid HEYGEN_API_KEY.",
  HEYGEN_UPSTREAM_ERROR:
    "Avatar service is temporarily unavailable. Try again or use text chat.",
  HEYGEN_BAD_REQUEST:
    "Avatar could not start with this profile. Check voice and avatar settings.",
};

export function messageForHeygenCode(
  code: string | undefined,
  fallback: string,
): string {
  if (code && code in HEYGEN_ERROR_USER_MESSAGES) {
    return HEYGEN_ERROR_USER_MESSAGES[code as HeygenErrorCode];
  }
  return fallback;
}

export function throwHeygenTokenError(errData: {
  error?: string;
  code?: string;
}): never {
  const fallback =
    typeof errData.error === "string" ? errData.error : "Failed to get session token";
  const message = messageForHeygenCode(errData.code, fallback);
  const code = errData.code as HeygenErrorCode | undefined;
  throw new HeygenSessionError(message, code);
}
