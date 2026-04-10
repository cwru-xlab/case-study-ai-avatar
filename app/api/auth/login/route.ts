import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createToken } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Email/password login is completely disabled in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Email login is disabled. Please use CWRU SSO." },
        { status: 403 }
      );
    }

    // Development: authenticate user
    const user = await authenticateUser(email, password);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createToken(user);

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    // Set HTTP-only cookie with JWT token using centralized config
    response.cookies.set(siteConfig.auth.cookie.name, token, {
      ...siteConfig.auth.cookie,
      maxAge: siteConfig.auth.cookieMaxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
