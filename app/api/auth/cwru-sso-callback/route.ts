import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/edge-config";
import {
  validateCWRUTicket,
  createOrUpdateCWRUUser,
  createToken,
} from "@/lib/auth";
import { siteConfig } from "@/config/site";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get("ticket");
    const serviceUrl = request.url.split("?")[0]; // Remove query params to get service URL

    if (!ticket) {
      return NextResponse.redirect(
        new URL("/login?error=missing_ticket", request.url)
      );
    }

    // Validate the CAS ticket with CWRU
    const validationResult = await validateCWRUTicket(ticket, serviceUrl);

    if (!validationResult.success || !validationResult.userInfo) {
      console.error("CWRU SSO validation failed:", validationResult.error);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(validationResult.error || "SSO validation failed")}`,
          request.url
        )
      );
    }

    // Get admin users list from Edge Config
    const adminUsersString = await get("adminUsersCaseIds");
    let isAdmin = false;

    if (adminUsersString && typeof adminUsersString === "string") {
      const adminIds = adminUsersString.split(",").map((id) => id.trim());
      isAdmin = adminIds.includes(validationResult.userInfo.studentId);
    }

    // Determine role based on admin list
    const role = isAdmin ? "admin" : "user";

    // Create or update user based on CWRU data
    const user = await createOrUpdateCWRUUser(validationResult.userInfo, role);

    // Create JWT token
    const token = await createToken(user);

    // Create redirect response to home page
    const response = NextResponse.redirect(new URL("/", request.url));

    // Set HTTP-only cookie with JWT token using centralized config
    response.cookies.set(siteConfig.auth.cookie.name, token, {
      ...siteConfig.auth.cookie,
      maxAge: siteConfig.auth.cookieMaxAge,
    });

    return response;
  } catch (error) {
    console.error("CWRU SSO callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=sso_error", request.url)
    );
  }
}
