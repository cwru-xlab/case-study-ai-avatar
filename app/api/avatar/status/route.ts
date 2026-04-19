import { NextResponse } from "next/server";
import {
  getHeygenApiKey,
  getLiveAvatarApiUrl,
  HEYGEN_REST_API_BASE,
} from "@/lib/heygen-server";

/**
 * Public integration status for the client (no secrets).
 * Use to align UI with whether avatar mode can work.
 */
export async function GET() {
  const apiKey = getHeygenApiKey();
  const configured = Boolean(apiKey);
  const liveAvatarApiUrl = getLiveAvatarApiUrl();
  const hasProbe = configured;
  let probeOk = false;
  let probeCode: "ok" | "missing_key" | "invalid_key" | "upstream_error" =
    configured ? "upstream_error" : "missing_key";
  let probeMessage = configured
    ? "Health check not executed yet"
    : "HEYGEN_API_KEY is missing";

  if (apiKey) {
    try {
      const res = await fetch(`${HEYGEN_REST_API_BASE}/v2/avatars`, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        probeOk = true;
        probeCode = "ok";
        probeMessage = "HeyGen API key accepted";
      } else if (res.status === 401 || res.status === 403) {
        probeCode = "invalid_key";
        probeMessage = "HeyGen rejected API key";
      } else {
        probeCode = "upstream_error";
        probeMessage = `HeyGen responded with HTTP ${res.status}`;
      }
    } catch {
      probeCode = "upstream_error";
      probeMessage = "Failed to reach HeyGen service";
    }
  }

  return NextResponse.json({
    heygenConfigured: configured,
    liveAvatarApiUrl,
    probe: {
      checked: hasProbe,
      ok: probeOk,
      code: probeCode,
      message: probeMessage,
    },
  });
}
