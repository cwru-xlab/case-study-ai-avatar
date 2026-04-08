import { mockAvatars, type MockAvatar } from "@/lib/mock-avatars";

// In-memory storage for demo avatars (simulates database)
// In production, replace with actual database calls
let demoAvatars: MockAvatar[] = [...mockAvatars];

export interface DemoAvatarInput {
  name: string;
  systemPrompt: string;
  description?: string;
  createdBy: string;
  published?: boolean;
}

export interface DemoAvatarUpdate {
  name?: string;
  systemPrompt?: string;
  description?: string;
  lastEditedBy?: string;
}

export const demoAvatarStorage = {
  // Get all avatars
  getAll(): MockAvatar[] {
    return [...demoAvatars];
  },

  // Get avatar by ID
  getById(id: string): MockAvatar | undefined {
    return demoAvatars.find((a) => a.id === id);
  },

  // Check if avatar exists
  exists(id: string): boolean {
    return demoAvatars.some((a) => a.id === id);
  },

  // Get avatar index (for determining published status)
  getIndex(id: string): number {
    return demoAvatars.findIndex((a) => a.id === id);
  },

  // Create a new avatar
  create(input: DemoAvatarInput): MockAvatar {
    const id = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const now = new Date().toISOString();
    const newAvatar: MockAvatar = {
      id,
      name: input.name,
      systemPrompt: input.systemPrompt,
      description: input.description,
      createdBy: input.createdBy,
      lastEditedBy: input.createdBy,
      createdAt: now,
      lastEditedAt: now,
    };

    demoAvatars.push(newAvatar);
    return newAvatar;
  },

  // Update an avatar
  update(id: string, updates: DemoAvatarUpdate): MockAvatar | null {
    const index = demoAvatars.findIndex((a) => a.id === id);
    if (index === -1) return null;

    demoAvatars[index] = {
      ...demoAvatars[index],
      ...updates,
      id, // Ensure ID doesn't change
      lastEditedAt: new Date().toISOString(),
    };
    return demoAvatars[index];
  },

  // Delete an avatar
  delete(id: string): boolean {
    const index = demoAvatars.findIndex((a) => a.id === id);
    if (index === -1) return false;

    demoAvatars.splice(index, 1);
    return true;
  },

  // Reset to initial mock data (useful for testing)
  reset(): void {
    demoAvatars = [...mockAvatars];
  },

  // Get total count
  count(): number {
    return demoAvatars.length;
  },
};
