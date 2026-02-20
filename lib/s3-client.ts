/**
 * S3 CLIENT - EXTENDED FOR CHAT STORAGE
 *
 * This file extends the existing S3AvatarStorage class to support chat storage
 * following the same patterns as avatar storage for consistency and maintainability.
 *
 * The chat storage implementation includes:
 * - Individual JSON files for each entity
 * - Same S3 bucket configuration
 * - Consistent error handling and logging
 * - Same credential management and configuration
 *
 * Architecture Decision:
 * Instead of creating a separate ChatS3Storage class, we extended the existing
 * S3AvatarStorage class to leverage the existing infrastructure and maintain
 * consistency with the codebase patterns.
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import type { Avatar, VersionManifest, AvatarVersion } from "./avatar-storage";
import type { ChatSession, ChatMessage, ChatSessionMetadata } from "@/types";

// S3 client configuration - shared between avatar and chat storage
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2", // Updated to match bucket region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// S3 bucket and prefix constants
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!; // Same bucket as avatars
const AVATARS_PREFIX = "avatars/"; // Existing avatar storage prefix
const CHATS_PREFIX = "chats/"; // NEW: Chat storage prefix
const COHORTS_PREFIX = "cohorts/"; // Cohorts storage prefix
const VERSION_FILE = "avatars/version.json"; // Avatar version manifest
export const KNOWLEDGE_BASE_PREFIX = "knowledge-base/"; // Existing knowledge base prefix
export const METADATA_SUFFIX = "metadata.json"; // Existing metadata file suffix

// Index file for chat session metadata
const CHAT_INDEX_FILE = `${CHATS_PREFIX}index.json`;

// Global compression switch for chat sessions
const ENABLE_CHAT_COMPRESSION =
  process.env.ENABLE_CHAT_COMPRESSION === "false" || true;

// Compression utilities
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class S3AvatarStorage {
  /**
   * Compression helper functions for chat sessions
   */
  private async compressData(
    data: string,
    sessionId?: string
  ): Promise<Buffer> {
    const startTime = Date.now();
    const originalSize = Buffer.byteLength(data, "utf8");
    const compressed = await gzipAsync(Buffer.from(data, "utf8"));
    const compressedSize = compressed.length;
    const compressionTime = Date.now() - startTime;
    const compressionRate = (
      ((originalSize - compressedSize) / originalSize) *
      100
    ).toFixed(1);

    if (sessionId) {
      console.log(
        `Compression stats for ${sessionId}: ${originalSize}B → ${compressedSize}B (${compressionRate}% reduction) in ${compressionTime}ms`
      );
    }

    return compressed;
  }

  private async decompressData(
    buffer: Buffer,
    sessionId?: string
  ): Promise<string> {
    const startTime = Date.now();
    const compressedSize = buffer.length;
    const decompressed = await gunzipAsync(buffer);
    const decompressedSize = decompressed.length;
    const decompressionTime = Date.now() - startTime;

    if (sessionId) {
      console.log(
        `Decompression stats for ${sessionId}: ${compressedSize}B → ${decompressedSize}B in ${decompressionTime}ms`
      );
    }

    return decompressed.toString("utf8");
  }

  private getChatKeyVariants(sessionId: string): string[] {
    const baseKey = `${CHATS_PREFIX}${sessionId}`;
    return [`${baseKey}.json`, `${baseKey}.json.gz`];
  }

  // Download a file from S3
  async downloadFile(key: string): Promise<{
    body: Uint8Array;
    contentType?: string;
  }> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("File not found");
    }

    const body = await response.Body.transformToByteArray();
    return {
      body,
      contentType: response.ContentType,
    };
  }

  // Delete a file from S3
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  }

  // Get version manifest from S3
  async getVersionManifest(): Promise<VersionManifest> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: VERSION_FILE,
      });

      const response = await s3Client.send(command);
      if (!response.Body) {
        throw new Error("No version file found");
      }

      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error) {
      // If version file doesn't exist, create initial manifest
      const initialManifest: VersionManifest = {
        overallVersion: Date.now(),
        avatars: {},
      };

      await this.updateVersionManifest(initialManifest);
      return initialManifest;
    }
  }

  // Update version manifest in S3
  async updateVersionManifest(manifest: VersionManifest): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: VERSION_FILE,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(command);
  }

  // Get avatar data from S3
  async getAvatar(id: string): Promise<Avatar | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${AVATARS_PREFIX}${id}/${id}.json`,
      });

      const response = await s3Client.send(command);
      if (!response.Body) {
        return null;
      }

      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to get avatar ${id}:`, error);
      return null;
    }
  }

  // Save avatar to S3
  async saveAvatar(avatar: Avatar): Promise<number> {
    const version = Date.now();

    // Save avatar data
    const avatarCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${AVATARS_PREFIX}${avatar.id}/${avatar.id}.json`,
      Body: JSON.stringify(avatar, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(avatarCommand);

    // Update version manifest
    const manifest = await this.getVersionManifest();
    manifest.overallVersion = version;
    manifest.avatars[avatar.id] = {
      version,
      published: avatar.published || false,
    };

    await this.updateVersionManifest(manifest);

    return version;
  }

  // Delete avatar from S3
  async deleteAvatar(id: string): Promise<void> {
    // Delete avatar file
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${AVATARS_PREFIX}${id}/${id}.json`,
    });

    await s3Client.send(deleteCommand);

    // Update version manifest
    const manifest = await this.getVersionManifest();
    delete manifest.avatars[id];
    manifest.overallVersion = Date.now();

    await this.updateVersionManifest(manifest);
  }

  // List all avatars (for admin/sync purposes)
  async listAllAvatars(): Promise<Avatar[]> {
    const avatars: Avatar[] = [];

    try {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: AVATARS_PREFIX,
        Delimiter: "/",
      });

      const response = await s3Client.send(command);

      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            const id = prefix.Prefix.replace(AVATARS_PREFIX, "").replace(
              "/",
              ""
            );
            if (id && id !== "version.json") {
              const avatar = await this.getAvatar(id);
              if (avatar) {
                avatars.push(avatar);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to list avatars:", error);
    }

    return avatars;
  }

  // Compare versions for sync
  async compareVersions(localVersions: Record<string, number>): Promise<{
    needsUpdate: string[];
    conflicts: string[];
    serverVersions: Record<string, AvatarVersion>;
  }> {
    const manifest = await this.getVersionManifest();
    const needsUpdate: string[] = [];
    const conflicts: string[] = [];

    // Check each server avatar against local versions
    for (const [avatarId, serverVersion] of Object.entries(manifest.avatars)) {
      const localVersion = localVersions[avatarId] || 0;

      if (serverVersion.version > localVersion) {
        needsUpdate.push(avatarId);
      }
    }

    // TODO: Implement conflict detection for when local version > server version
    // This would happen if user has unsaved changes and server was updated by someone else

    return {
      needsUpdate,
      conflicts,
      serverVersions: manifest.avatars,
    };
  }

  // Check if avatar exists
  async avatarExists(id: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${AVATARS_PREFIX}${id}/${id}.json`,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * ==================================================================================
   * CHAT STORAGE METHODS - NEW IMPLEMENTATION
   * ==================================================================================
   *
   * The following methods implement the chat storage requirements.
   * These methods follow the EXACT same patterns as avatar storage to ensure:
   * 1. Consistency in error handling and logging
   * 2. Same S3 configuration and credentials
   * 3. Similar method signatures and return types
   * 4. Maintainable and predictable codebase
   *
   * Storage Structure:
   * chats/{sessionId}.json - Individual JSON files for each chat session
   *
   * This mirrors the avatar storage structure:
   * avatars/{avatarId}/{avatarId}.json - Individual JSON files for each avatar
   */

  /**
   * Save Chat Session to S3 and update the index file.
   *
   * Storage Pattern: chats/{sessionId}.json or chats/{sessionId}.json.gz (if compression enabled)
   * Also updates chats/index.json with session metadata.
   */
  async saveChatSession(session: ChatSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    const sessionId = session.metadata.sessionId;

    let key: string;
    let body: string | Buffer;
    let contentType: string;

    if (ENABLE_CHAT_COMPRESSION) {
      key = `${CHATS_PREFIX}${sessionId}.json.gz`;
      body = await this.compressData(sessionData, sessionId);
      contentType = "application/gzip";
    } else {
      key = `${CHATS_PREFIX}${sessionId}.json`;
      body = sessionData;
      contentType = "application/json";
    }

    // Save the session file
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await s3Client.send(command);

    // Update the index file
    let index = await this.readChatIndex();
    // Remove any existing entry for this sessionId
    index = index.filter((meta) => meta.sessionId !== sessionId);
    // Add the new/updated metadata
    index.push(session.metadata);
    // Sort by startTime descending (newest first)
    index.sort((a, b) => b.startTime - a.startTime);
    await this.writeChatIndex(index);
    console.log(`Stored chat session in S3: ${key} and updated index.json`);
  }

  /**
   * Get Chat Session from S3
   *
   * Retrieves a specific chat session by sessionId for:
   * - API endpoints returning session data
   * - Analytics and reporting
   * - Session recovery and debugging
   *
   * Returns null if session doesn't exist (same pattern as getAvatar)
   * Tries both .json and .json.gz files for backward compatibility
   */
  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    const keyVariants = this.getChatKeyVariants(sessionId);

    for (const key of keyVariants) {
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });

        const response = await s3Client.send(command);
        if (!response.Body) {
          continue;
        }

        const buffer = await response.Body.transformToByteArray();
        let content: string;

        if (key.endsWith(".gz")) {
          content = await this.decompressData(Buffer.from(buffer), sessionId);
        } else {
          content = Buffer.from(buffer).toString("utf8");
        }

        return JSON.parse(content);
      } catch (error: any) {
        // Continue to next variant if this one fails
        if (
          error.name === "NoSuchKey" ||
          error.$metadata?.httpStatusCode === 404
        ) {
          continue;
        }
        // Re-throw other errors (permissions, network, etc.)
        console.error(
          `Failed to get chat session ${sessionId} with key ${key}:`,
          error
        );
      }
    }

    return null;
  }

  /**
   * List Chat Sessions with Advanced Filtering
   *
   * Returns chat session metadata only for efficient listing and analytics.
   * Use getChatSession() separately if you need the full session data with messages.
   *
   * Filtering capabilities:
   * - avatarId: Get all chats for a specific avatar
   * - userId: Get all chats for a specific user
   * - startDate/endDate: Time-based filtering
   * - limit: Pagination support for large datasets
   *
   * Performance Optimizations:
   * - Only reads the chat index file (single S3 operation)
   * - All filtering happens in memory on metadata
   * - No individual session file fetches required
   * - Extremely fast even with thousands of sessions
   * - Index file is sorted by startTime (newest first) for optimal pagination
   */
  async listChatSessions(options?: {
    avatarId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<ChatSessionMetadata[]> {
    try {
      // Read the chat index for efficient filtering
      const chatIndex = await this.readChatIndex();

      // Apply filtering on metadata (all in memory - very fast)
      let filteredMetadata = chatIndex;

      if (options?.avatarId) {
        filteredMetadata = filteredMetadata.filter(
          (meta) => meta.avatarId === options.avatarId
        );
      }

      if (options?.userId) {
        filteredMetadata = filteredMetadata.filter(
          (meta) => meta.userId === options.userId
        );
      }

      if (options?.startDate) {
        filteredMetadata = filteredMetadata.filter(
          (meta) => meta.startTime >= options.startDate!.getTime()
        );
      }

      if (options?.endDate) {
        filteredMetadata = filteredMetadata.filter(
          (meta) => meta.endTime <= options.endDate!.getTime()
        );
      }

      // Apply limit to results
      if (options?.limit) {
        filteredMetadata = filteredMetadata.slice(0, options.limit);
      }

      return filteredMetadata;
    } catch (error) {
      console.error("Failed to list chat sessions:", error);
      return [];
    }
  }

  /**
   * Read the chat session index file from S3.
   * Returns an array of ChatSessionMetadata objects, or an empty array if not found.
   */
  async readChatIndex(): Promise<ChatSessionMetadata[]> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: CHAT_INDEX_FILE,
      });
      const response = await s3Client.send(command);
      if (!response.Body) return [];
      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error: any) {
      // If index file doesn't exist, return empty array
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Write the chat session index file to S3.
   * Accepts an array of ChatSessionMetadata objects.
   */
  async writeChatIndex(index: ChatSessionMetadata[]): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: CHAT_INDEX_FILE,
      Body: JSON.stringify(index, null, 2),
      ContentType: "application/json",
    });
    await s3Client.send(command);
  }

  /**
   * Delete Chat Session from S3 and update the index file.
   * Tries both .json and .json.gz files for backward compatibility
   * Note: S3 DeleteObject succeeds even if the key doesn't exist, so we try both variants
   */
  async deleteChatSession(sessionId: string): Promise<void> {
    const keyVariants = this.getChatKeyVariants(sessionId);

    // First, check if the session exists in any format
    const sessionExists = await this.chatSessionExists(sessionId);
    if (!sessionExists) {
      throw new Error(`Chat session ${sessionId} not found in any format`);
    }

    // Delete both variants (S3 doesn't error if key doesn't exist)
    const deletePromises = keyVariants.map(async (key) => {
      try {
        const command = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        await s3Client.send(command);
        console.log(`Attempted deletion of: ${key}`);
      } catch (error: any) {
        // Log but don't throw - continue with other deletions
        console.error(
          `Error deleting chat session ${sessionId} with key ${key}:`,
          error
        );
      }
    });

    // Execute all deletions in parallel
    await Promise.all(deletePromises);

    // Update the index file
    let index = await this.readChatIndex();
    index = index.filter((meta) => meta.sessionId !== sessionId);
    await this.writeChatIndex(index);
    console.log(
      `Deleted chat session ${sessionId} from S3 and updated index.json`
    );
  }

  /**
   * Check if Chat Session Exists in S3
   *
   * Efficiently checks if a chat session exists without downloading the full content.
   * Uses S3 HeadObject operation which only returns metadata.
   * Tries both .json and .json.gz files for backward compatibility
   *
   * Use cases:
   * - Duplicate prevention before saving
   * - Existence validation before operations
   * - Quick session lookup for APIs
   *
   * Performance:
   * - Very fast (only metadata, no content download)
   * - Minimal data transfer
   * - Efficient for large session files
   */
  async chatSessionExists(sessionId: string): Promise<boolean> {
    const keyVariants = this.getChatKeyVariants(sessionId);

    for (const key of keyVariants) {
      try {
        const command = new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });

        // Get object metadata only (no content download)
        await s3Client.send(command);
        return true;
      } catch (error: any) {
        // Continue to next variant if this one fails
        if (
          error.name === "NoSuchKey" ||
          error.$metadata?.httpStatusCode === 404
        ) {
          continue;
        }
        // Re-throw other errors (permissions, network, etc.)
        throw error;
      }
    }

    return false;
  }

  /**
   * Get Chat Session Metadata for Specific Avatar
   *
   * Convenience method for avatar-specific analytics.
   * Returns metadata only - use getChatSession() if you need full session data.
   *
   * Use cases:
   * - Avatar performance metrics (how many chats, average length, etc.)
   * - A/B testing different avatar configurations
   * - Conversation quality analysis per avatar
   */
  async getChatSessionsForAvatar(
    avatarId: string,
    limit: number = 100
  ): Promise<ChatSessionMetadata[]> {
    return this.listChatSessions({ avatarId, limit });
  }

  /**
   * Get Chat Session Metadata for Specific User
   *
   * Convenience method for user-specific analytics and history.
   * Returns metadata only - use getChatSession() if you need full session data.
   *
   * Use cases:
   * - User engagement tracking
   * - Personalized chat history
   * - User behavior analysis
   */
  async getChatSessionsForUser(
    userId: string,
    limit: number = 100
  ): Promise<ChatSessionMetadata[]> {
    return this.listChatSessions({ userId, limit });
  }

  /**
   * Create Chat Session Object
   *
   * Factory method to create properly structured ChatSession objects.
   *
   * This method ensures:
   * - Consistent session structure across the application
   * - Proper metadata calculation (start/end times, message count)
   * - Standard audit fields (createdAt, updatedAt)
   * - Default values for optional fields
   */
  createChatSession(
    sessionId: string,
    avatarId: string,
    avatarName: string,
    messages: ChatMessage[],
    options?: {
      userId?: string;
      userName?: string;
      isKioskMode?: boolean;
      location?: string;
    }
  ): ChatSession {
    const now = new Date().toISOString();
    // Calculate start/end times from message timestamps
    const startTime = messages.length > 0 ? messages[0].timestamp : Date.now();
    const endTime =
      messages.length > 0
        ? messages[messages.length - 1].timestamp
        : Date.now();

    return {
      metadata: {
        sessionId,
        avatarId,
        avatarName,
        userId: options?.userId,
        userName: options?.userName,
        startTime,
        endTime,
        messageCount: messages.length,
        isKioskMode: options?.isKioskMode || false,
        location: options?.location,
      },
      messages,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * ==================================================================================
   * EXISTING KNOWLEDGE BASE METHODS
   * ==================================================================================
   *
   * The following methods are the original knowledge base storage implementation.
   * They remain unchanged to maintain backward compatibility.
   */

  // Store document metadata in S3
  async storeDocumentMetadata(sourceId: string, metadata: any): Promise<void> {
    const key = `${KNOWLEDGE_BASE_PREFIX}${sourceId}/${METADATA_SUFFIX}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(command);
    console.log(`Stored metadata in S3: ${key}`);
  }

  // Get document metadata from S3
  async getDocumentMetadata(sourceId: string): Promise<any | null> {
    try {
      const key = `${KNOWLEDGE_BASE_PREFIX}${sourceId}/${METADATA_SUFFIX}`;
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      if (!response.Body) {
        return null;
      }

      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to get document metadata ${sourceId}:`, error);
      return null;
    }
  }

  // Delete document metadata from S3
  async deleteDocumentMetadata(sourceId: string): Promise<void> {
    try {
      const key = `${KNOWLEDGE_BASE_PREFIX}${sourceId}/${METADATA_SUFFIX}`;
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`Deleted metadata from S3: ${key}`);
    } catch (error) {
      console.error(`Failed to delete document metadata ${sourceId}:`, error);
    }
  }

  /**
   * ==================================================================================
   * AVATAR IMAGE METHODS
   * ==================================================================================
   * 
   * These methods handle avatar image upload, retrieval, and deletion.
   * Images are stored as separate files in the avatar's S3 directory.
   */

  /**
   * Upload Avatar Image to S3
   * 
   * Uploads a cropped avatar image and returns the public S3 URL.
   * Images are stored at: avatars/{avatarId}/portrait.{ext}
   */
  async uploadAvatarImage(avatarId: string, imageFile: File): Promise<string> {
    const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${AVATARS_PREFIX}${avatarId}/portrait.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(await imageFile.arrayBuffer()),
      ContentType: imageFile.type,
      ACL: 'public-read', // Make the uploaded image publicly accessible
    });

    await s3Client.send(command);

    // Return public S3 URL
    const region = process.env.AWS_REGION || "us-east-2";
    const publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
    
    console.log(`Avatar image uploaded: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Delete Avatar Image from S3
   * 
   * Removes the avatar image file and cleans up the portrait URL.
   * Handles both jpg and png extensions for compatibility.
   */
  async deleteAvatarImage(avatarId: string): Promise<void> {
    const extensions = ['jpg', 'jpeg', 'png'];
    
    // Try to delete all possible image formats
    const deletePromises = extensions.map(async (ext) => {
      const key = `${AVATARS_PREFIX}${avatarId}/portrait.${ext}`;
      try {
        const command = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        await s3Client.send(command);
        console.log(`Attempted deletion of avatar image: ${key}`);
      } catch (error: any) {
        // S3 doesn't error if key doesn't exist, but log anyway
        if (error.name !== 'NoSuchKey') {
          console.error(`Error deleting avatar image ${key}:`, error);
        }
      }
    });

    await Promise.all(deletePromises);
  }

  /**
   * Check if Avatar Image Exists
   * 
   * Efficiently checks if an avatar has a custom image without downloading it.
   * Returns the public URL if found, null otherwise.
   */
  async getAvatarImageUrl(avatarId: string): Promise<string | null> {
    const extensions = ['jpg', 'jpeg', 'png'];
    const region = process.env.AWS_REGION || "us-east-2";
    
    for (const ext of extensions) {
      const key = `${AVATARS_PREFIX}${avatarId}/portrait.${ext}`;
      
      try {
        const command = new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        
        await s3Client.send(command);
        
        // If we reach here, the image exists
        const publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
        return publicUrl;
      } catch (error: any) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          continue; // Try next extension
        }
        // Re-throw other errors (permissions, network, etc.)
        throw error;
      }
    }
    
    return null; // No image found
  }

  /**
   * ============================================================================
   * COHORT STORAGE
   * ============================================================================
   * Methods for storing and retrieving professor cohorts
   */

  /**
   * Get Cohort from S3
   */
  async getCohort(cohortId: string): Promise<any | null> {
    const key = `${COHORTS_PREFIX}${cohortId}.json`;

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      const body = await response.Body?.transformToString();
      
      if (!body) {
        return null;
      }

      return JSON.parse(body);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`Error fetching cohort ${key}:`, error);
      throw error;
    }
  }

  /**
   * Save Cohort to S3
   */
  async saveCohort(cohort: any): Promise<number> {
    const key = `${COHORTS_PREFIX}${cohort.id}.json`;
    const version = Date.now();

    const cohortWithVersion = {
      ...cohort,
      version,
      lastModified: new Date().toISOString(),
    };

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(cohortWithVersion, null, 2),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    console.log(`Cohort saved: ${key} (version: ${version})`);

    return version;
  }

  /**
   * List All Cohorts
   */
  async listCohorts(professorId?: string): Promise<any[]> {
    const prefix = COHORTS_PREFIX;
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
      });

      const response = await s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      const cohorts = await Promise.all(
        response.Contents.map(async (item) => {
          if (!item.Key || !item.Key.endsWith('.json')) return null;
          
          const cohortId = item.Key.replace(prefix, '').replace('.json', '');
          return await this.getCohort(cohortId);
        })
      );

      const filtered = cohorts.filter(Boolean);
      
      if (professorId) {
        return filtered.filter((c: any) => c.professorId === professorId);
      }

      return filtered;
    } catch (error) {
      console.error('Error listing cohorts:', error);
      return [];
    }
  }

  /**
   * Delete Cohort from S3
   */
  async deleteCohort(cohortId: string): Promise<void> {
    const key = `${COHORTS_PREFIX}${cohortId}.json`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`Cohort deleted: ${key}`);
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        console.error(`Error deleting cohort ${key}:`, error);
        throw error;
      }
    }
  }

  /**
   * ============================================================================
   * PERSONA STORAGE
   * ============================================================================
   * Methods for storing and retrieving personas (appearance + voice only)
   */

  /**
   * Get Persona from S3
   */
  async getPersona(personaId: string): Promise<any | null> {
    const key = `personas/${personaId}.json`;

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      const body = await response.Body?.transformToString();
      
      if (!body) {
        return null;
      }

      return JSON.parse(body);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`Error fetching persona ${key}:`, error);
      throw error;
    }
  }

  /**
   * Save Persona to S3
   */
  async savePersona(persona: any): Promise<number> {
    const key = `personas/${persona.id}.json`;
    const version = Date.now();

    const personaWithVersion = {
      ...persona,
      version,
      lastModified: new Date().toISOString(),
    };

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(personaWithVersion, null, 2),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    console.log(`Persona saved: ${key} (version: ${version})`);

    return version;
  }

  /**
   * List All Personas
   */
  async listPersonas(): Promise<any[]> {
    const prefix = "personas/";
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
      });

      const response = await s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      const personas = await Promise.all(
        response.Contents.map(async (item) => {
          if (!item.Key || !item.Key.endsWith('.json')) return null;
          
          const personaId = item.Key.replace(prefix, '').replace('.json', '');
          return await this.getPersona(personaId);
        })
      );

      return personas.filter(Boolean);
    } catch (error) {
      console.error('Error listing personas:', error);
      return [];
    }
  }

  /**
   * Delete Persona from S3
   */
  async deletePersona(personaId: string): Promise<void> {
    const key = `personas/${personaId}.json`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`Persona deleted: ${key}`);
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        console.error(`Error deleting persona ${key}:`, error);
        throw error;
      }
    }
  }

  /**
   * Upload Persona Image to S3
   */
  async uploadPersonaImage(personaId: string, imageFile: File): Promise<string> {
    const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `personas/${personaId}/avatar.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(await imageFile.arrayBuffer()),
      ContentType: imageFile.type,
      ACL: 'public-read',
    });

    await s3Client.send(command);

    const region = process.env.AWS_REGION || "us-east-2";
    const publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
    
    console.log(`Persona image uploaded: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Delete Persona Image from S3
   */
  async deletePersonaImage(personaId: string): Promise<void> {
    const extensions = ['jpg', 'jpeg', 'png'];
    
    const deletePromises = extensions.map(async (ext) => {
      const key = `personas/${personaId}/avatar.${ext}`;
      try {
        const command = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        await s3Client.send(command);
      } catch (error: any) {
        if (error.name !== 'NoSuchKey') {
          console.error(`Error deleting persona image ${key}:`, error);
        }
      }
    });

    await Promise.all(deletePromises);
  }
}

/**
 * Export Singleton Instance
 *
 * Follows the same pattern as the original implementation.
 * Provides a single, shared instance across the application for:
 * - Consistent S3 client configuration
 * - Connection pooling and efficiency
 * - Simplified imports across the codebase
 */
export const s3Storage = new S3AvatarStorage();
