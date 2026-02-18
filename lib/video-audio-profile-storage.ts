import { openDB, DBSchema, IDBPDatabase } from "idb";

import type { VideoAudioProfile, CachedVideoAudioProfile, VoiceConfig } from "../types";

// Default voice configuration
const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  rate: 1.1,
  voiceId: "df6420135ba44094b85874084b45c410",
  emotion: undefined,
};

// Default profile configuration
export const DEFAULT_PROFILE_CONFIG: Omit<VideoAudioProfile, "id" | "name" | "createdBy" | "lastEditedBy" | "createdAt" | "lastEditedAt"> = {
  quality: "low",
  avatarName: "Ann_Therapist_public",
  language: "en",
  voice: DEFAULT_VOICE_CONFIG,
  knowledgeId: undefined,
  description: undefined,
};

// IndexedDB schema for video/audio profiles
interface VideoAudioProfileDB extends DBSchema {
  profiles: {
    key: string; // profile id
    value: CachedVideoAudioProfile;
  };
  metadata: {
    key: string;
    value: any;
  };
}

class VideoAudioProfileStorage {
  private db: IDBPDatabase<VideoAudioProfileDB> | null = null;
  private initialized = false;

  // Initialize IndexedDB
  private async initDB(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<VideoAudioProfileDB>("video-audio-profile-cache", 1, {
      upgrade(db) {
        // Create profiles store
        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "id" });
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
  private async ensureDB(): Promise<IDBPDatabase<VideoAudioProfileDB>> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  // Generate version number (timestamp)
  private generateVersion(): number {
    return Date.now();
  }

  // Generate ID from name
  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Add new profile (persists to S3 via API, caches in IndexedDB)
  async add(
    profileData: Omit<VideoAudioProfile, "id" | "createdAt" | "lastEditedAt">
  ): Promise<VideoAudioProfile> {
    const db = await this.ensureDB();

    const id = this.generateId(profileData.name);

    if (id === "new") {
      throw new Error('Profile name cannot generate "new" as ID');
    }

    const now = new Date().toISOString();

    const profile: VideoAudioProfile = {
      ...profileData,
      id,
      createdAt: now,
      lastEditedAt: now,
    };

    // Persist to S3 via API
    const response = await fetch("/api/profile/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create profile");
    }

    const version = this.generateVersion();

    const cachedProfile: CachedVideoAudioProfile = {
      ...profile,
      localVersion: version,
      remoteVersion: version,
      isDirty: false,
    };

    await db.put("profiles", cachedProfile);

    return profile;
  }

  // Update existing profile locally (marks as dirty until save)
  async updateLocal(id: string, updates: Partial<VideoAudioProfile>): Promise<void> {
    const db = await this.ensureDB();

    const existing = await db.get("profiles", id);
    if (!existing) {
      throw new Error(`Profile ${id} not found`);
    }

    const now = new Date().toISOString();
    const version = this.generateVersion();

    const updatedProfile: CachedVideoAudioProfile = {
      ...existing,
      ...updates,
      lastEditedAt: now,
      localVersion: version,
      isDirty: true,
    };

    await db.put("profiles", updatedProfile);
  }

  // Save local changes to S3 via API
  async save(id: string): Promise<VideoAudioProfile> {
    const db = await this.ensureDB();

    const cached = await db.get("profiles", id);
    if (!cached) {
      throw new Error(`Profile ${id} not found`);
    }

    if (!cached.isDirty) {
      return cached;
    }

    const { isDirty, localVersion, remoteVersion, ...profileData } = cached;

    const response = await fetch("/api/profile/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, profile: profileData }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to save profile");
    }

    const result = await response.json();
    const version = this.generateVersion();

    const updatedCached: CachedVideoAudioProfile = {
      ...result.profile,
      localVersion: version,
      remoteVersion: version,
      isDirty: false,
    };

    await db.put("profiles", updatedCached);

    return result.profile;
  }

  // List all profiles (syncs from server, merges with local cache)
  async list(): Promise<CachedVideoAudioProfile[]> {
    const db = await this.ensureDB();

    try {
      const response = await fetch("/api/profile/list");
      if (response.ok) {
        const data = await response.json();
        const serverProfiles: VideoAudioProfile[] = data.profiles || [];
        const version = this.generateVersion();

        // Get current local dirty profiles to preserve their state
        const localProfiles = await db.getAll("profiles");
        const dirtyMap = new Map(
          localProfiles.filter((p) => p.isDirty).map((p) => [p.id, p])
        );

        // Update IndexedDB with server data, but preserve dirty locals
        for (const profile of serverProfiles) {
          if (!dirtyMap.has(profile.id)) {
            const cached: CachedVideoAudioProfile = {
              ...profile,
              localVersion: version,
              remoteVersion: version,
              isDirty: false,
            };
            await db.put("profiles", cached);
          }
        }

        // Remove local profiles that no longer exist on server (unless dirty)
        const serverIds = new Set(serverProfiles.map((p) => p.id));
        for (const local of localProfiles) {
          if (!serverIds.has(local.id) && !local.isDirty) {
            await db.delete("profiles", local.id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to sync profiles from server:", error);
    }

    const profiles = await db.getAll("profiles");
    return profiles.sort((a, b) =>
      new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime()
    );
  }

  // Get single profile (tries IndexedDB first, falls back to API)
  async get(id: string): Promise<CachedVideoAudioProfile | null> {
    const db = await this.ensureDB();

    const cached = await db.get("profiles", id);
    if (cached) return cached;

    try {
      const response = await fetch(`/api/profile/get?id=${encodeURIComponent(id)}`);
      if (response.ok) {
        const data = await response.json();
        const profile: VideoAudioProfile = data.profile;
        const version = this.generateVersion();

        const cachedProfile: CachedVideoAudioProfile = {
          ...profile,
          localVersion: version,
          remoteVersion: version,
          isDirty: false,
        };

        await db.put("profiles", cachedProfile);
        return cachedProfile;
      }
    } catch (error) {
      console.error("Failed to fetch profile from server:", error);
    }

    return null;
  }

  // Delete profile (deletes from S3 via API and removes from IndexedDB)
  async delete(id: string): Promise<void> {
    const db = await this.ensureDB();

    const response = await fetch("/api/profile/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete profile");
    }

    await db.delete("profiles", id);
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    total: number;
    dirty: number;
    synced: number;
  }> {
    const db = await this.ensureDB();
    const profiles = await db.getAll("profiles");

    const dirty = profiles.filter((p) => p.isDirty).length;
    const synced = profiles.length - dirty;

    return {
      total: profiles.length,
      dirty,
      synced,
    };
  }

  // Check if a profile with the given name/id exists
  async exists(nameOrId: string): Promise<boolean> {
    const db = await this.ensureDB();
    const id = this.generateId(nameOrId);
    const existing = await db.get("profiles", id);
    return !!existing;
  }

  // Duplicate a profile with a new name
  async duplicate(id: string, newName: string, userName: string): Promise<VideoAudioProfile> {
    const db = await this.ensureDB();

    const existing = await db.get("profiles", id);
    if (!existing) {
      throw new Error(`Profile ${id} not found`);
    }

    const newProfile = await this.add({
      name: newName,
      description: existing.description ? `Copy of: ${existing.description}` : `Copy of ${existing.name}`,
      quality: existing.quality,
      avatarName: existing.avatarName,
      language: existing.language,
      voice: { ...existing.voice },
      knowledgeId: existing.knowledgeId,
      createdBy: userName,
      lastEditedBy: userName,
    });

    return newProfile;
  }
}

// Export singleton instance
export const videoAudioProfileStorage = new VideoAudioProfileStorage();
