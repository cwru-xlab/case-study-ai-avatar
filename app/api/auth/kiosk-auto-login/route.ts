import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { createHash, createDecipheriv } from "crypto";
import { get } from "@vercel/edge-config";

/**
 * Decrypt ticket using AES-256-GCM with key derived from edge config hash + timestamp
 */
function decryptTicket(encryptedTicket: string, timestamp: number, kioskModePasswordSHA256: string): string | null {
  try {
    // Create decryption key by concatenating hash and timestamp
    const key = kioskModePasswordSHA256 + timestamp.toString();
    
    // Create SHA-256 hash of the key to get 32 bytes for AES-256
    const keyHash = createHash("sha256").update(key).digest();
    
    // Decode the encrypted ticket from hex
    const encryptedData = Buffer.from(encryptedTicket, "hex");
    
    // Extract IV (first 12 bytes), auth tag (last 16 bytes), and ciphertext
    const iv = encryptedData.subarray(0, 12);
    const authTag = encryptedData.subarray(encryptedData.length - 16);
    const ciphertext = encryptedData.subarray(12, encryptedData.length - 16);
    
    // Create decipher
    const decipher = createDecipheriv("aes-256-gcm", keyHash, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString("utf8");
  } catch (error) {
    // Decryption failed (wrong key, corrupted data, etc.)
    return null;
  }
}

/**
 * Validate kiosk ticket by decrypting and comparing SHA512 hash
 */
async function validateKioskTicket(ticket: string): Promise<boolean> {
  try {
    // Get configuration from Edge Config
    const kioskModePasswordSHA256 = await get<string>("kioskModePasswordSHA256");
    const kioskModePasswordSHA512 = await get<string>("kioskModePasswordSHA512");
    
    if (!kioskModePasswordSHA256 || !kioskModePasswordSHA512) {
      console.error("Kiosk mode passwords not configured in Edge Config");
      return false;
    }
    
    // Get current unix timestamp in seconds
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Floor to nearest 10 seconds
    const flooredTimestamp = Math.floor(currentTimestamp / 10) * 10;
    
    // First attempt: try with current floored timestamp
    const firstDecrypted = decryptTicket(ticket, flooredTimestamp, kioskModePasswordSHA256);
    
    if (firstDecrypted) {
      // Hash the decrypted password with SHA512
      const passwordHash = createHash("sha512").update(firstDecrypted).digest("hex");
      
      if (passwordHash === kioskModePasswordSHA512) {
        return true;
      }
    }
    
    // Second attempt: try with timestamp - 10 (edge case at 10-second boundary)
    const secondTimestamp = flooredTimestamp - 10;
    const secondDecrypted = decryptTicket(ticket, secondTimestamp, kioskModePasswordSHA256);
    
    if (secondDecrypted) {
      // Hash the decrypted password with SHA512
      const passwordHash = createHash("sha512").update(secondDecrypted).digest("hex");
      
      if (passwordHash === kioskModePasswordSHA512) {
        return true;
      }
    }
    
    // Both attempts failed
    return false;
  } catch (error) {
    console.error("Error validating kiosk ticket:", error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get("ticket");

    if (!ticket) {
      return NextResponse.redirect(
        new URL("/login?error=missing_ticket", request.url)
      );
    }

    // Validate the kiosk ticket
    const isValid = await validateKioskTicket(ticket);

    if (!isValid) {
      console.error("Kiosk auto-login validation failed: invalid ticket");
      return NextResponse.redirect(
        new URL(
          "/login?error=invalid_ticket",
          request.url
        )
      );
    }

    // Create kiosk user
    const kioskUser = {
      id: "kiosk_user",
      email: "weatherhead-avatar-kiosk@case.edu",
      name: "Kiosk Mode User",
      role: "kiosk",
      authProvider: "email" as const,
    };

    // Create JWT token
    const token = await createToken(kioskUser);

    // Create redirect response to home page
    const response = NextResponse.redirect(new URL("/", request.url));

    // Set HTTP-only cookie with JWT token using centralized config
    response.cookies.set(siteConfig.auth.cookie.name, token, {
      ...siteConfig.auth.cookie,
      maxAge: siteConfig.auth.cookieMaxAge,
    });

    return response;
  } catch (error) {
    console.error("Kiosk auto-login callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=kiosk_auto_login_error", request.url)
    );
  }
}

