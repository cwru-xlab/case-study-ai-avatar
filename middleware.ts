/**
 * NEXT.JS MIDDLEWARE - AUTHENTICATION AND AUTHORIZATION
 *
 * This middleware provides comprehensive security for the AI Avatar Kiosk application.
 * It handles JWT-based authentication and role-based authorization for all protected routes.
 *
 * Key Features:
 * - JWT token validation for all protected routes
 * - Three-tier role-based access control (public, kiosk, admin)
 * - Public route exceptions for login and authentication flows
 * - Different error handling for API vs page routes
 * - Integration with centralized site configuration
 *
 * Security Model:
 * - All routes are protected by default unless explicitly listed as public
 * - Three access levels:
 *   1. Public routes: accessible to all users (unauthenticated)
 *   2. Kiosk routes: accessible to kiosk and admin users
 *   3. Admin routes: accessible to admin users only
 * - Invalid tokens are cleared and users redirected to login
 * - API routes return JSON errors, page routes redirect with error params
 *
 * Role-Based Access Control:
 * - Unauthenticated users: public routes only
 * - Kiosk users: public + kiosk routes
 * - Admin users: public + kiosk + admin routes (full access)
 *
 * Chat Storage Integration:
 * The chat API endpoints (/api/chat/*) are protected as admin-only routes
 * to ensure only authorized administrators can access chat session data.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { siteConfig } from "@/config/site";

// Secret key for JWT verification (in production, use environment variable)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * PUBLIC ROUTES CONFIGURATION
 *
 * Routes that don't require authentication - accessible to all users.
 * These are essential for the authentication flow itself and public content.
 *
 * Routes included:
 * - /login: Login page for user authentication
 * - /api/auth/*: All authentication-related API endpoints
 *   - /api/auth/login: User login processing
 *   - /api/auth/logout: User logout processing
 *   - /api/auth/me: Current user information
 *   - /api/auth/cwru-sso-callback: CWRU SSO integration
 *
 * Security consideration:
 * Keep this list minimal to maintain security by default.
 * All other routes require authentication.
 */
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/cwru-sso-callback",
  "/api/auth/kiosk-auto-login",
  // CTA (Call to Action) public endpoints
  "/api/cta/validate-session", // Session validation for CTA forms
  "/api/cta/submit", // Form submission from mobile users
  "/cta/form", // CTA form page for mobile users
];

/**
 * ADMIN-ONLY ROUTES CONFIGURATION
 *
 * Routes that require admin role for access - highest privilege level.
 * These routes control critical system functionality and sensitive data.
 *
 * Page Routes (Admin Dashboard):
 * - /system-settings: System configuration and management
 * - /avatar-management: Avatar creation, editing, and management
 * - /users-and-usages: User management and usage analytics
 * - /kiosk: Kiosk mode interface and controls
 *
 * API Routes (Avatar Management):
 * - /api/llm/preview: AI model preview and testing
 * - /api/avatar/*: All avatar management operations
 *   - /api/avatar/sync: Avatar synchronization with S3
 *   - /api/avatar/add: Create new avatars
 *   - /api/avatar/edit: Modify existing avatars
 *   - /api/avatar/delete: Remove avatars
 *   - /api/avatar/get: Retrieve avatar data
 *
 * API Routes (Chat Storage):
 * These routes were added as part of the chat storage implementation
 * to ensure only administrators can access chat session data.
 *
 * - /api/chat/save: Save chat sessions to S3 storage
 * - /api/chat/list: List and filter chat sessions (analytics)
 * - /api/chat/get: Retrieve specific chat sessions
 * - /api/chat/delete: Delete chat sessions (privacy compliance)
 *
 * Security rationale for chat routes:
 * - Chat sessions contain sensitive user conversations
 * - Analytics access should be limited to administrators
 * - Deletion capabilities require high privilege level
 * - Privacy compliance operations need audit trail
 */
const ADMIN_ROUTES = [
  "/system-settings",
  "/case-management",
  "/avatar-management",
  "/users-and-usages",
  "/kiosk/main-display",
  "/kiosk/touch-screen",
  "/api/llm/preview",
  "/api/llm/production",
  "/api/avatar/sync",
  "/api/avatar/add",
  "/api/avatar/edit",
  "/api/avatar/delete",
  "/api/avatar/get",
  "/api/avatar/get-access-token",
  // All test pages
  "/test-pages",
  // Chat storage API endpoints (added for chat storage implementation)
  "/api/chat/save", // Save chat sessions
  "/api/chat/list", // List sessions for analytics dashboard
  "/api/chat/get", // Retrieve individual sessions
  "/api/chat/delete", // Delete sessions for privacy compliance
  "/api/chat/save-kiosk", // Kiosk will also have a logged in user, so this endpoint do not need to be public
  "/api/chat/download",
  "/api/knowledge",
  "/api/documents",
  // Chat session viewing routes (added for direct URL access)
  "/chat/view", // Direct chat session viewing by session ID
  // CTA (Call to Action) admin endpoints
  "/api/cta/config", // CTA configuration management
  "/api/cta/submissions", // CTA submissions viewing and management
  "/api/cta/generate-qr", // QR code generation for kiosk
  "/cta-management", // CTA admin portal section
  "/api/audio/transcribe",
  // Profile management API endpoints
  "/api/profile/add",
  "/api/profile/edit",
  "/api/profile/delete",
  "/api/profile/get",
  "/api/profile/list",
  "/avatar-profiles",
  // Case management API endpoints
  "/api/case/add",
  "/api/case/edit",
  "/api/case/delete",
  "/api/case/get",
  "/api/case/list",
];

/**
 * KIOSK-ONLY ROUTES CONFIGURATION
 *
 * Routes that kiosk users can access in addition to public routes.
 * These routes provide kiosk-specific functionality while maintaining security.
 *
 * Access Control:
 * - Admin users: Can access public + admin routes (including these kiosk routes)
 * - Kiosk users: Can access public + kiosk routes (this subset)
 * - Regular users: Cannot access these routes
 *
 * Security rationale:
 * - Kiosk mode needs specific functionality without full admin privileges
 * - Provides controlled access to essential kiosk operations
 * - Maintains separation between kiosk and full administrative access
 */
const KIOSK_ROUTES: string[] = [
  "/kiosk/main-display",
  "/kiosk/touch-screen",
  "/api/llm/preview",
  "/api/avatar/sync",
  "/api/avatar/get",
  "/api/avatar/get-access-token",
  "/api/chat/save-kiosk", // Kiosk will also have a logged in user, so this endpoint do not need to be public
  "/api/cta/generate-qr", // QR code generation for kiosk
  "/api/audio/transcribe",
];

/**
 * MAIN MIDDLEWARE FUNCTION
 *
 * Processes every request to determine authentication and authorization requirements.
 * Implements a security-first approach where all routes are protected by default.
 *
 * Flow:
 * 1. Check if route is public (skip authentication)
 * 2. Check if route is static/system (skip middleware)
 * 3. Validate JWT token exists
 * 4. Verify JWT token signature and payload
 * 5. Check admin role for admin-only routes
 * 6. Allow or deny access based on validation results
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * PUBLIC ROUTE AND STATIC FILE BYPASS
   *
   * Allows unrestricted access to:
   * - Public routes (login, auth endpoints)
   * - Next.js system routes (_next/*)
   * - Static files (detected by file extensions)
   *
   * This optimization prevents unnecessary JWT validation for
   * resources that don't require authentication.
   */
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") // Skip static files (images, CSS, JS, etc.)
  ) {
    return NextResponse.next();
  }

  /**
   * JWT TOKEN EXTRACTION
   *
   * Retrieves the authentication token from HTTP cookies.
   * Uses centralized configuration for cookie name consistency.
   *
   * Token storage strategy:
   * - HTTP-only cookies for security (prevents XSS attacks)
   * - Centralized cookie configuration in siteConfig
   * - Consistent cookie handling across authentication routes
   */
  const token = request.cookies.get(siteConfig.auth.cookie.name)?.value;

  /**
   * UNAUTHENTICATED USER HANDLING
   *
   * Redirects users without valid tokens to the login page.
   * This enforces authentication for all protected routes.
   */
  if (!token) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    /**
     * JWT TOKEN VERIFICATION
     *
     * Validates the JWT token using the configured secret key.
     * Verifies both signature and token structure.
     *
     * Security features:
     * - Cryptographic signature verification
     * - Expiration time validation
     * - Token structure validation
     * - Protection against token tampering
     */
    const { payload } = await jwtVerify(token, JWT_SECRET);

    /**
     * ROLE-BASED AUTHORIZATION
     *
     * Implements three-tier access control system:
     * 1. Public routes: accessible to all users
     * 2. Kiosk routes: accessible to kiosk and admin users
     * 3. Admin routes: accessible to admin users only
     *
     * This provides granular control over system functionality while
     * maintaining security and proper privilege separation.
     */

    // Extract user role from JWT payload
    const userRole = payload.role as string;

    /**
     * KIOSK ROUTE AUTHORIZATION
     *
     * For kiosk-specific routes, allows both kiosk and admin users.
     * This enables kiosk functionality without requiring full admin privileges.
     */
    const isKioskRoute = KIOSK_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (isKioskRoute) {
      /**
       * KIOSK ROLE VERIFICATION
       *
       * Allows access for both kiosk and admin users.
       * Provides appropriate error responses for unauthorized access.
       */
      if (userRole !== "kiosk" && userRole !== "admin") {
        // User is not kiosk or admin but trying to access kiosk route

        /**
         * API ROUTE ERROR HANDLING
         */
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Access denied: kiosk or admin role required" },
            { status: 403 }
          );
        } else {
          /**
           * PAGE ROUTE ERROR HANDLING
           */
          return NextResponse.redirect(
            new URL("/?error=access_denied", request.url)
          );
        }
      } else {
        return NextResponse.next();
      }
    }

    /**
     * ADMIN ROUTE AUTHORIZATION
     *
     * For admin-only routes, verifies the user has admin privileges.
     * This implements the highest privilege level in the system.
     *
     * Chat storage routes are included in admin-only routes because:
     * - Chat sessions contain sensitive user data
     * - Analytics access should be restricted
     * - Deletion capabilities require high privileges
     * - Compliance operations need proper authorization
     */
    const isAdminRoute = ADMIN_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (isAdminRoute) {
      /**
       * ADMIN ROLE VERIFICATION
       *
       * Checks if the authenticated user has admin privileges.
       * Provides different error responses for API vs page routes.
       */
      if (userRole !== "admin") {
        // User is not admin but trying to access admin route

        /**
         * API ROUTE ERROR HANDLING
         *
         * For API routes, returns structured JSON error response.
         * This provides clear error information for API consumers.
         */
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Access denied: admin only" },
            { status: 403 }
          );
        } else {
          /**
           * PAGE ROUTE ERROR HANDLING
           *
           * For page routes, redirects to home with error parameter.
           * This provides user-friendly error handling in the UI.
           */
          return NextResponse.redirect(
            new URL("/?error=access_denied", request.url)
          );
        }
      }
    }

    /**
     * SUCCESSFUL AUTHORIZATION
     *
     * Token is valid and user has appropriate permissions.
     * Allow the request to continue to the target route.
     */
    return NextResponse.next();
  } catch (error) {
    /**
     * JWT VERIFICATION FAILURE HANDLING
     *
     * Handles cases where JWT verification fails:
     * - Invalid token signature
     * - Expired tokens
     * - Malformed tokens
     * - Missing required claims
     *
     * Security response:
     * - Clear the invalid token to prevent repeated failures
     * - Redirect to login for re-authentication
     * - Log error for debugging (but don't expose details to client)
     */
    console.error("JWT verification failed:", error);

    /**
     * INVALID TOKEN CLEANUP
     *
     * Removes the invalid token from cookies and redirects to login.
     * Uses centralized cookie configuration for consistency.
     */
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(siteConfig.auth.cookie.name);

    return response;
  }
}

/**
 * MIDDLEWARE CONFIGURATION
 *
 * Configures which routes the middleware should process.
 * Uses Next.js matcher configuration to exclude system routes.
 *
 * Excluded paths:
 * - _next/static: Static assets (CSS, JS, images)
 * - _next/image: Next.js image optimization
 * - favicon.ico: Browser favicon requests
 *
 * This optimization prevents middleware execution for requests
 * that don't require authentication or authorization checks.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
