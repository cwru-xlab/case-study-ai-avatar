import { SignJWT, jwtVerify } from "jose";
import { siteConfig } from "@/config/site";
import { get } from "@vercel/edge-config";
import crypto from "crypto";
import { prisma } from "./prisma";
import { Role, AuthProvider } from "@prisma/client";

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

/**
 * Hash a password using SHA-512
 */
export function hashPassword(password: string): string {
  return crypto.createHash("sha512").update(password).digest("hex");
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Convert Prisma Role enum to string for JWT
 */
function roleToString(role: Role): string {
  return role.toLowerCase();
}

/**
 * Convert Prisma AuthProvider enum to string for JWT
 */
function authProviderToString(provider: AuthProvider): "email" | "cwru_sso" {
  return provider === AuthProvider.CWRU_SSO ? "cwru_sso" : "email";
}

/**
 * Authenticate user credentials with email and password
 * Now reads from database instead of mock users
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  // Email/password login is completely disabled in production
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  // Development only: authenticate from database
  try {
    const dbUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!dbUser) {
      return null;
    }

    // Check if user is active
    if (!dbUser.isActive) {
      console.log(`User ${email} is deactivated`);
      return null;
    }

    // Check if user has a password (SSO users don't)
    if (!dbUser.passwordHash) {
      console.log(`User ${email} has no password (SSO user)`);
      return null;
    }

    // Verify password
    if (!verifyPassword(password, dbUser.passwordHash)) {
      return null;
    }

    // Update last login time
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name || "",
      role: roleToString(dbUser.role),
      studentId: dbUser.studentNumber || undefined,
      authProvider: authProviderToString(dbUser.authProvider),
    };
  } catch (error) {
    console.error("Database authentication error:", error);
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
 * Create or update CWRU SSO user in database
 */
export async function createOrUpdateCWRUUser(
  userInfo: CWRUUserInfo,
  role: string = "student"
): Promise<User> {
  // Convert role string to enum
  const roleEnum = role.toUpperCase() as keyof typeof Role;
  const prismaRole = Role[roleEnum] || Role.STUDENT;

  // Upsert user in database
  const dbUser = await prisma.user.upsert({
    where: { email: userInfo.mail },
    update: {
      name: `${userInfo.givenName} ${userInfo.sn}`,
      studentNumber: userInfo.studentId,
      lastLoginAt: new Date(),
    },
    create: {
      email: userInfo.mail,
      name: `${userInfo.givenName} ${userInfo.sn}`,
      role: prismaRole,
      studentNumber: userInfo.studentId,
      authProvider: AuthProvider.CWRU_SSO,
      emailVerified: true, // SSO users are verified
      lastLoginAt: new Date(),
    },
  });

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || "",
    role: roleToString(dbUser.role),
    studentId: dbUser.studentNumber || undefined,
    authProvider: "cwru_sso",
  };
}

/**
 * Create a new user with email/password
 */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: Role = Role.STUDENT,
  studentNumber?: string
): Promise<User> {
  const passwordHash = hashPassword(password);

  const dbUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      studentNumber,
      authProvider: AuthProvider.EMAIL,
    },
  });

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || "",
    role: roleToString(dbUser.role),
    studentId: dbUser.studentNumber || undefined,
    authProvider: "email",
  };
}

/**
 * Get user by ID from database
 */
export async function getUserById(id: string): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || "",
    role: roleToString(dbUser.role),
    studentId: dbUser.studentNumber || undefined,
    authProvider: authProviderToString(dbUser.authProvider),
  };
}

/**
 * Get user by email from database
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const dbUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || "",
    role: roleToString(dbUser.role),
    studentId: dbUser.studentNumber || undefined,
    authProvider: authProviderToString(dbUser.authProvider),
  };
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  action: "LOGIN" | "LOGOUT" | "CREATE" | "UPDATE" | "DELETE" | "ATTEMPT_START" | "ATTEMPT_SUBMIT",
  userId?: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
