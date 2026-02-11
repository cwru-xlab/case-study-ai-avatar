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

  // Add new profile
  async add(
    profileData: Omit<VideoAudioProfile, "id" | "createdAt" | "lastEditedAt">
  ): Promise<VideoAudioProfile> {
    const db = await this.ensureDB();

    // Generate ID from name
    const id = this.generateId(profileData.name);

    if (id === "new") {
      throw new Error('Profile name cannot generate "new" as ID');
    }

    // Check if ID already exists
    const existing = await db.get("profiles", id);
    if (existing) {
      throw new Error(`A profile with ID "${id}" already exists`);
    }

    const now = new Date().toISOString();
    const version = this.generateVersion();

    const profile: VideoAudioProfile = {
      ...profileData,
      id,
      createdAt: now,
      lastEditedAt: now,
    };

    const cachedProfile: CachedVideoAudioProfile = {
      ...profile,
      localVersion: version,
      remoteVersion: 0, // Will be set after API call (future)
      isDirty: true,
    };

    // Cache locally
    await db.put("profiles", cachedProfile);

    // TODO: In the future, call API to persist to S3
    // For now, frontend-only storage

    return profile;
  }

  // Update existing profile locally
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

  // Save local changes (future: to server)
  async save(id: string): Promise<VideoAudioProfile> {
    const db = await this.ensureDB();

    const cached = await db.get("profiles", id);
    if (!cached) {
      throw new Error(`Profile ${id} not found`);
    }

    if (!cached.isDirty) {
      return cached; // No changes to save
    }

    // TODO: In the future, call API to update S3
    // For now, just mark as saved locally
    cached.isDirty = false;
    await db.put("profiles", cached);

    return cached;
  }

  // List all profiles
  async list(): Promise<CachedVideoAudioProfile[]> {
    const db = await this.ensureDB();
    const profiles = await db.getAll("profiles");
    
    // Sort by lastEditedAt descending (most recent first)
    return profiles.sort((a, b) => 
      new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime()
    );
  }

  // Get single profile
  async get(id: string): Promise<CachedVideoAudioProfile | null> {
    const db = await this.ensureDB();
    return (await db.get("profiles", id)) || null;
  }

  // Delete profile
  async delete(id: string): Promise<void> {
    const db = await this.ensureDB();

    const existing = await db.get("profiles", id);
    if (!existing) {
      throw new Error(`Profile ${id} not found`);
    }

    // TODO: In the future, delete from server first
    // For now, just delete locally
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

    // Create new profile with copied settings
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
