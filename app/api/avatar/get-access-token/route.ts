import {
  getHeygenApiKey,
  getHeygenAvatarContextId,
  getLiveAvatarApiUrl,
  heygenJsonError,
  classifyUpstreamSessionError,
} from "@/lib/heygen-server";

interface StartSessionRequestBody {
  avatar_id: string;
  voice_id: string;
  language?: string;
}

export async function POST(request: Request) {
  const apiKey = getHeygenApiKey();
  if (!apiKey) {
    return heygenJsonError(
      "HEYGEN_MISSING_KEY",
      "HEYGEN_API_KEY is not set on the server.",
      503,
    );
  }

  const API_URL = getLiveAvatarApiUrl();

  try {
    const body: StartSessionRequestBody = await request.json();
    const { avatar_id, voice_id, language = "en" } = body;

    if (!avatar_id || !voice_id) {
      return heygenJsonError(
        "HEYGEN_BAD_REQUEST",
        "avatar_id and voice_id are required",
        400,
      );
    }

    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id,
        avatar_persona: {
          voice_id,
          context_id: getHeygenAvatarContextId(),
          language,
        },
        is_sandbox: false,
      }),
    });

    if (!res.ok) {
      let rawMessage = "Failed to retrieve session token";
      const contentType = res.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        try {
          const resp = await res.json();
          if (resp.data && resp.data.length > 0) {
            rawMessage = resp.data[0].message;
          } else if (resp.error) {
            rawMessage = resp.error;
          } else if (resp.message) {
            rawMessage = resp.message;
          }
        } catch {
          // ignore parse errors
        }
      } else {
        const text = await res.text();
        rawMessage = text || rawMessage;
      }

      const classified = classifyUpstreamSessionError(res.status, rawMessage);
      return new Response(
        JSON.stringify({
          error: classified.message,
          code: classified.code,
        }),
        {
          status: classified.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await res.json();
    const session_token = data.data.session_token;
    const session_id = data.data.session_id;

    if (!session_token) {
      return heygenJsonError(
        "HEYGEN_UPSTREAM_ERROR",
        "Failed to retrieve session token",
        500,
      );
    }

    return new Response(JSON.stringify({ session_token, session_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return heygenJsonError(
      "HEYGEN_UPSTREAM_ERROR",
      (error as Error).message || "Unknown error",
      500,
    );
  }
}
