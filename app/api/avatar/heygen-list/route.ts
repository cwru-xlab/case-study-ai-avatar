import {
  getHeygenApiKey,
  HEYGEN_REST_API_BASE,
  heygenJsonError,
} from "@/lib/heygen-server";

interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string;
}

interface CacheEntry {
  data: HeyGenAvatar[];
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cache: CacheEntry | null = null;

export async function GET() {
  try {
    const HEYGEN_API_KEY = getHeygenApiKey();
    if (!HEYGEN_API_KEY) {
      return heygenJsonError(
        "HEYGEN_MISSING_KEY",
        "HEYGEN_API_KEY is not set on the server.",
        503,
      );
    }

    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ avatars: cache.data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${HEYGEN_REST_API_BASE}/v2/avatars`, {
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      let msg = "Failed to fetch HeyGen avatar list";
      try {
        const errBody = await res.json();
        msg = errBody?.message || errBody?.error || msg;
      } catch {
        /* ignore */
      }
      const code =
        res.status === 401 || res.status === 403
          ? "HEYGEN_INVALID_KEY"
          : "HEYGEN_UPSTREAM_ERROR";
      return new Response(JSON.stringify({ error: msg, code }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const avatars: HeyGenAvatar[] = (data?.data?.avatars ?? []).map(
      (a: HeyGenAvatar) => ({
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name,
        preview_image_url: a.preview_image_url,
      })
    );

    cache = { data: avatars, timestamp: Date.now() };

    return new Response(JSON.stringify({ avatars }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
