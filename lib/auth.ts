import { SignJWT, jwtVerify } from "jose";
import { siteConfig } from "@/config/site";
import { get } from "@vercel/edge-config";
import crypto from "crypto";

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Token expiration time from centralized config
const JWT_EXPIRES_IN = siteConfig.auth.jwtExpiresIn;

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  studentId?: string;
  authProvider?: "email" | "cwru_sso";
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
  role?: string;
  studentId?: string;
  authProvider?: "email" | "cwru_sso";
  iat: number;
  exp: number;
}

export interface CWRUUserInfo {
  mail: string;
  givenName: string;
  sn: string;
  studentId: string;
  [key: string]: string;
}

/**
 * Create a JWT token for a user
 */
export async function createToken(user: User): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "user",
    studentId: user.studentId || "",
    authProvider: user.authProvider || "email",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthTokenPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Get the current user from the JWT token in cookies
 */
export async function getCurrentUser(token: string): Promise<User | null> {
  try {
    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }

    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      studentId: payload.studentId,
      authProvider: payload.authProvider,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// Mock user database (in production, replace with actual database)
const MOCK_USERS = [
  {
    id: "1",
    email: "admin@example.com",
    password: "admin123", // In production, this should be hashed
    name: "Admin User",
    role: "admin",
    authProvider: "email" as const,
  },
  {
    id: "2",
    email: "user@example.com",
    password: "user123", // In production, this should be hashed
    name: "Regular User",
    role: "user",
    authProvider: "email" as const,
  },
];

// Store for CWRU SSO users (in production, use actual database)
const CWRU_USERS: Array<User & { password?: string }> = [];

/**
 * Hash a password using SHA-512
 */
function hashPassword(password: string): string {
  return crypto.createHash("sha512").update(password).digest("hex");
}

/**
 * Authenticate user credentials with email and password
 * (only allowed in development, except for kiosk mode in production)
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  // Check for kiosk mode credentials in production
  if (process.env.NODE_ENV === "production") {
    try {
      const kioskModeUsername = await get("kioskModeUsername");
      const kioskModePasswordHash = await get("kioskModePasswordSHA512");

      // Hash the input password and compare with stored hash
      const inputPasswordHash = hashPassword(password);
      
      if (email === kioskModeUsername && inputPasswordHash === kioskModePasswordHash) {
        // Return kiosk user
        return {
          id: "kiosk_user",
          email: email,
          name: "Kiosk Mode User",
          role: "kiosk",
          authProvider: "email",
        };
      }
    } catch (error) {
      console.error("Error checking kiosk mode credentials:", error);
    }

    // If not kiosk mode, don't allow email/password auth in production
    return null;
  } else if (process.env.NODE_ENV === "development") {
    // In development, allow normal mock user authentication
    const user = MOCK_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      authProvider: user.authProvider,
    };
  } else {
    return null;
  }
}

/**
 * Generate CWRU SSO login URL
 */
export function generateCWRUSSOLoginURL(baseUrl: string): string {
  const callbackUrl = `${baseUrl}/api/auth/cwru-sso-callback`;
  const loginUrl = `https://login.case.edu/cas/login?service=${encodeURIComponent(callbackUrl)}`;
  return loginUrl;
}

/**
 * Validate CWRU CAS ticket
 */
export async function validateCWRUTicket(
  ticket: string,
  serviceUrl: string
): Promise<{ success: boolean; userInfo?: CWRUUserInfo; error?: string }> {
  try {
    const validateUrl = "https://login.case.edu/cas/serviceValidate";
    const params = new URLSearchParams({
      ticket,
      service: serviceUrl,
    });

    const response = await fetch(`${validateUrl}?${params.toString()}`);
    const xmlText = await response.text();

    // Parse XML response using regex (simple approach for Node.js)
    if (xmlText.includes("<cas:authenticationFailure")) {
      const failureMatch = xmlText.match(
        /<cas:authenticationFailure[^>]*>(.*?)<\/cas:authenticationFailure>/
      );
      const errorMsg = failureMatch ? failureMatch[1] : "Authentication failed";
      return { success: false, error: errorMsg };
    }

    if (!xmlText.includes("<cas:authenticationSuccess")) {
      return { success: false, error: "Authentication failed" };
    }

    // Extract user information using regex
    const userMatch = xmlText.match(/<cas:user>(.*?)<\/cas:user>/);
    const studentId = userMatch ? userMatch[1] : "";

    if (!studentId) {
      return { success: false, error: "Student ID not found" };
    }

    // Extract attributes
    const mailMatch = xmlText.match(/<cas:mail>(.*?)<\/cas:mail>/);
    const givenNameMatch = xmlText.match(
      /<cas:givenName>(.*?)<\/cas:givenName>/
    );
    const snMatch = xmlText.match(/<cas:sn>(.*?)<\/cas:sn>/);

    const userInfo: CWRUUserInfo = {
      studentId,
      mail: mailMatch ? mailMatch[1] : "",
      givenName: givenNameMatch ? givenNameMatch[1] : "",
      sn: snMatch ? snMatch[1] : "",
    };

    // Validate required fields
    if (!userInfo.mail || !userInfo.givenName || !userInfo.sn) {
      return { success: false, error: "Incomplete user information" };
    }

    return { success: true, userInfo };
  } catch (error) {
    console.error("Error validating CWRU ticket:", error);
    return { success: false, error: "Failed to validate ticket" };
  }
}

/**
 * Create or update CWRU SSO user
 */
export async function createOrUpdateCWRUUser(
  userInfo: CWRUUserInfo,
  role: string = "user"
): Promise<User> {
  // Check if user already exists
  let existingUser = CWRU_USERS.find((u) => u.studentId === userInfo.studentId);

  if (existingUser) {
    // Update existing user
    existingUser.email = userInfo.mail;
    existingUser.name = `${userInfo.givenName} ${userInfo.sn}`;
    existingUser.role = role; // Update role based on admin check
    return existingUser;
  }

  // Create new user
  const newUser: User = {
    id: `cwru_${userInfo.studentId}`,
    email: userInfo.mail,
    name: `${userInfo.givenName} ${userInfo.sn}`,
    role: role, // Use the provided role (admin or user)
    studentId: userInfo.studentId,
    authProvider: "cwru_sso",
  };

  CWRU_USERS.push(newUser);
  return newUser;
}
