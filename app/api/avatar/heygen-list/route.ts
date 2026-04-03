const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = "https://api.heygen.com";

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
    if (!HEYGEN_API_KEY) {
      return new Response(JSON.stringify({ error: "API key is missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ avatars: cache.data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${HEYGEN_API_URL}/v2/avatars`, {
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch HeyGen avatar list" }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
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
