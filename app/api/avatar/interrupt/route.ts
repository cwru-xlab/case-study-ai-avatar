const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function POST(request: Request) {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("API key is missing from .env");
    }

    const body = await request.json();
    const { session_id } = body || {};
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const baseApiUrl = process.env.NEXT_PUBLIC_HEYGEN_BASE_API_URL;
    const res = await fetch(`${baseApiUrl}/v1/streaming.interrupt`, {
      method: "POST",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({ error: "Upstream error", detail: text }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
