const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const API_URL =
  process.env.NEXT_PUBLIC_LIVEAVATAR_API_URL || "https://api.liveavatar.com";

const HARDCODED_CONTEXT_ID = "1932d96d-3404-4081-9fec-0d967c37cd72";

interface StartSessionRequestBody {
  avatar_id: string;
  voice_id: string;
  language?: string;
}

export async function POST(request: Request) {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("API key is missing from .env");
    }

    const body: StartSessionRequestBody = await request.json();
    const { avatar_id, voice_id, language = "en" } = body;

    if (!avatar_id || !voice_id) {
      return new Response(
        JSON.stringify({ error: "avatar_id and voice_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id,
        avatar_persona: {
          voice_id,
          context_id: HARDCODED_CONTEXT_ID,
          language,
        },
        is_sandbox: false,
      }),
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorMessage = "Failed to retrieve session token";

      if (contentType && contentType.includes("application/json")) {
        try {
          const resp = await res.json();
          if (resp.data && resp.data.length > 0) {
            errorMessage = resp.data[0].message;
          } else if (resp.error) {
            errorMessage = resp.error;
          } else if (resp.message) {
            errorMessage = resp.message;
          }
        } catch {
          // ignore parse errors
        }
      } else {
        const text = await res.text();
        errorMessage = text || errorMessage;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const session_token = data.data.session_token;
    const session_id = data.data.session_id;

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve session token" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ session_token, session_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
