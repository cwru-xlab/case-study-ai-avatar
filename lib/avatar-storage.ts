import { openDB, DBSchema, IDBPDatabase } from "idb";

import type { ConversationStarter, StartAvatarRequest } from "../types";
import type { SpeechPatternAnalysis } from "./speech-analysis";

// Core avatar data structure
export interface Avatar {
  id: string;
  name: string;
  title?: string; // Professional title (e.g., "Professor, Organizational Behavior")
  systemPrompt: string;
  conversationStarters?: ConversationStarter[];
  topics?: string[]; // Separate topics array for display
  portrait?: string; // URL to portrait photo
  createdBy: string;
  lastEditedBy: string;
  createdAt: string;
  lastEditedAt: string;
  description?: string;
  published?: boolean;
  settings?: StartAvatarRequest;
  speechAnalysis?: SpeechPatternAnalysis;
  speechPromptAddition?: string;
  speechSourceFiles?: Array<{
    name: string;
    type: "audio" | "transcript" | "pdf";
    uploadedAt: string;
  }>;
}

// Version tracking
export interface AvatarVersion {
  version: number;
  published: boolean;
}

export interface VersionManifest {
  overallVersion: number;
  avatars: Record<string, AvatarVersion>;
}

// Local cache with version info
export interface CachedAvatar extends Avatar {
  localVersion: number;
  remoteVersion: number;
  isDirty: boolean; // Has unsaved local changes
}

// IndexedDB schema
interface AvatarDB extends DBSchema {
  avatars: {
    key: string; // avatar id
    value: CachedAvatar;
  };
  metadata: {
    key: string;
    value: any;
  };
}

// Sync response from server
export interface SyncResponse {
  needsUpdate: string[]; // Avatar IDs that need updating from server
  conflicts: string[]; // Avatar IDs with local changes that conflict with server
  serverVersions: Record<string, AvatarVersion>;
}

class AvatarStorage {
  private db: IDBPDatabase<AvatarDB> | null = null;
  private initialized = false;

  // Initialize IndexedDB
  private async initDB(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<AvatarDB>("avatar-cache", 1, {
      upgrade(db) {
        // Create avatars store
        if (!db.objectStoreNames.contains("avatars")) {
          db.createObjectStore("avatars", { keyPath: "id" });
        }

        // Create metadata store for version tracking
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata");
        }
      },
    });

    this.initialized = true;
  }

  // Ensure DB is initialized
  private async ensureDB(): Promise<IDBPDatabase<AvatarDB>> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  // Generate version number (timestamp)
  private generateVersion(): number {
    return Date.now();
  }

  // Add new avatar
  async add(
    avatarData: Omit<Avatar, "id" | "createdAt" | "lastEditedAt">,
  ): Promise<Avatar> {
    const db = await this.ensureDB();

    // Generate ID from name
    const id = avatarData.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (id === "new") {
      throw new Error('Avatar name cannot generate "new" as ID');
    }

    const now = new Date().toISOString();
    const version = this.generateVersion();

    const avatar: Avatar = {
      ...avatarData,
      id,
      createdAt: now,
      lastEditedAt: now,
    };

    const cachedAvatar: CachedAvatar = {
      ...avatar,
      localVersion: version,
      remoteVersion: 0, // Will be set after API call
      isDirty: true,
    };

    // Cache locally first
    await db.put("avatars", cachedAvatar);

    try {
      // Call API to persist to S3
      const response = await fetch("/api/avatar/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(avatar),
      });

      if (!response.ok) {
        throw new Error(`Failed to add avatar: ${response.statusText}`);
      }

      const result = await response.json();

      // Update cache with server version
      cachedAvatar.remoteVersion = result.version;
      cachedAvatar.isDirty = false;
      await db.put("avatars", cachedAvatar);

      return avatar;
    } catch (error) {
      console.error("Failed to save to server, keeping local copy:", error);
      // Keep the local copy even if server fails
      return avatar;
    }
  }

  // Edit existing avatar (updates cache on every change)
  async updateLocal(id: string, updates: Partial<Avatar>): Promise<void> {
    const db = await this.ensureDB();

    const existing = await db.get("avatars", id);
    if (!existing) {
      throw new Error(`Avatar ${id} not found`);
    }

    const now = new Date().toISOString();
    const version = this.generateVersion();

    const updatedAvatar: CachedAvatar = {
      ...existing,
      ...updates,
      lastEditedAt: now,
      localVersion: version,
      isDirty: true,
    };

    await db.put("avatars", updatedAvatar);
  }

  // Save local changes to server
  async save(id: string): Promise<Avatar> {
    const db = await this.ensureDB();

    const cached = await db.get("avatars", id);
    if (!cached) {
      throw new Error(`Avatar ${id} not found`);
    }

    if (!cached.isDirty) {
      return cached; // No changes to save
    }

    try {
      // Call API to update S3
      const response = await fetch("/api/avatar/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          avatar: cached,
          expectedVersion: cached.remoteVersion,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to save avatar: ${error.error}`);
      }

      const result = await response.json();

      // Update cache with new server version
      cached.remoteVersion = result.version;
      cached.isDirty = false;
      await db.put("avatars", cached);

      return cached;
    } catch (error) {
      console.error("Failed to save to server:", error);
      throw error;
    }
  }

  // Publish/unpublish avatar
  async togglePublish(id: string, published: boolean): Promise<Avatar> {
    const db = await this.ensureDB();

    const cached = await db.get("avatars", id);
    if (!cached) {
      throw new Error(`Avatar ${id} not found`);
    }

    // Update local cache
    cached.published = published;
    cached.localVersion = this.generateVersion();
    cached.isDirty = true;
    await db.put("avatars", cached);

    try {
      // Call API to update S3
      const response = await fetch("/api/avatar/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          avatar: cached,
          expectedVersion: cached.remoteVersion,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to update publish status: ${response.statusText}`
        );
      }

      const result = await response.json();

      // Update cache with new server version
      cached.remoteVersion = result.version;
      cached.isDirty = false;
      await db.put("avatars", cached);

      return cached;
    } catch (error) {
      console.error("Failed to update publish status:", error);
      throw error;
    }
  }

  // List all avatars with sync
  async list(): Promise<CachedAvatar[]> {
    const db = await this.ensureDB();

    // Get all local avatars
    const localAvatars = await db.getAll("avatars");

    // Get local version manifest
    const localVersions: Record<string, number> = {};
    localAvatars.forEach((avatar) => {
      localVersions[avatar.id] = avatar.remoteVersion;
    });

    try {
      // Sync with server
      const response = await fetch("/api/avatar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localVersions }),
      });

      if (!response.ok) {
        console.warn("Failed to sync with server, using local data");
        return localAvatars;
      }

      const syncData: SyncResponse = await response.json();

      // Update avatars that need updating from server
      for (const avatarId of syncData.needsUpdate) {
        const updateResponse = await fetch(`/api/avatar/get?id=${avatarId}`);
        if (updateResponse.ok) {
          const serverAvatar = await updateResponse.json();
          const cached: CachedAvatar = {
            ...serverAvatar,
            localVersion: serverAvatar.version,
            remoteVersion: serverAvatar.version,
            isDirty: false,
          };
          await db.put("avatars", cached);
        }
      }

      // Delete local avatars that no longer exist on server
      const serverAvatarIds = new Set(Object.keys(syncData.serverVersions));
      for (const localAvatar of localAvatars) {
        if (!serverAvatarIds.has(localAvatar.id)) {
          console.log(`Avatar ${localAvatar.id} was deleted on server, removing locally`);
          await db.delete("avatars", localAvatar.id);
        }
      }

      // Refresh local avatars after sync
      return await db.getAll("avatars");
    } catch (error) {
      console.error("Sync failed, using local data:", error);
      return localAvatars;
    }
  }

  // Get single avatar
  async get(id: string): Promise<CachedAvatar | null> {
    const db = await this.ensureDB();
    return (await db.get("avatars", id)) || null;
  }

  // Get clean remote version (discarding local changes)
  async getRemoteVersion(id: string): Promise<CachedAvatar | null> {
    try {
      const response = await fetch(
        `/api/avatar/get?id=${encodeURIComponent(id)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(
          `Failed to fetch remote version: ${response.statusText}`
        );
      }

      const remoteAvatar = await response.json();

      // Convert to CachedAvatar format but mark as clean
      const cachedAvatar: CachedAvatar = {
        ...remoteAvatar,
        localVersion: this.generateVersion(),
        remoteVersion: remoteAvatar.version || 0,
        isDirty: false,
      };

      // Update local cache with clean version
      const db = await this.ensureDB();
      await db.put("avatars", cachedAvatar);

      return cachedAvatar;
    } catch (error) {
      console.error("Failed to fetch remote version:", error);
      throw error;
    }
  }

  // Delete avatar
  async delete(id: string): Promise<void> {
    const db = await this.ensureDB();

    try {
      // Delete from server first
      const response = await fetch("/api/avatar/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete avatar: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to delete from server:", error);
      throw error;
    }

    // Delete from local cache
    await db.delete("avatars", id);
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    total: number;
    dirty: number;
    synced: number;
  }> {
    const db = await this.ensureDB();
    const avatars = await db.getAll("avatars");

    const dirty = avatars.filter((a) => a.isDirty).length;
    const synced = avatars.length - dirty;

    return {
      total: avatars.length,
      dirty,
      synced,
    };
  }
}

// Export singleton instance
export const avatarStorage = new AvatarStorage();
