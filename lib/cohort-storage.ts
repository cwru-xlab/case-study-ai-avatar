/**
 * Cohort Storage - Client-side storage with S3 sync
 * Similar pattern to avatar-storage.ts
 */

import type {
  Cohort,
  CohortCreateInput,
  CohortUpdateInput,
  CachedCohort,
} from "@/types/cohort";

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const timestamp = Date.now().toString(36);
  return `${slug}-${timestamp}`;
}

class CohortStorage {
  private generateVersion(): number {
    return Date.now();
  }

  async add(input: CohortCreateInput): Promise<Cohort> {
    const id = generateId(input.name);
    const accessCode = generateAccessCode();
    const now = new Date().toISOString();

    const cohort: Cohort = {
      ...input,
      id,
      accessCode,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    try {
      const response = await fetch("/api/cohort/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cohort),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create cohort");
      }

      return cohort;
    } catch (error) {
      console.error("Failed to save cohort to server:", error);
      throw error;
    }
  }

  async update(id: string, updates: CohortUpdateInput): Promise<Cohort> {
    try {
      const response = await fetch(`/api/cohort/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update cohort");
      }

      const result = await response.json();
      return result.cohort;
    } catch (error) {
      console.error("Failed to update cohort:", error);
      throw error;
    }
  }

  async list(professorId?: string): Promise<CachedCohort[]> {
    try {
      const url = professorId
        ? `/api/cohort/list?professorId=${professorId}`
        : "/api/cohort/list";
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch cohorts");
      }

      const result = await response.json();
      const cohorts: Cohort[] = result.cohorts || [];

      return cohorts.map((cohort) => ({
        ...cohort,
        localVersion: this.generateVersion(),
        remoteVersion: 0,
        isDirty: false,
      }));
    } catch (error) {
      console.error("Failed to fetch cohorts:", error);
      return [];
    }
  }

  async get(id: string): Promise<CachedCohort | null> {
    try {
      const response = await fetch(`/api/cohort/get?id=${id}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch cohort");
      }

      const result = await response.json();
      const cohort = result.cohort;

      return {
        ...cohort,
        localVersion: this.generateVersion(),
        remoteVersion: 0,
        isDirty: false,
      };
    } catch (error) {
      console.error("Failed to fetch cohort:", error);
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/cohort/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete cohort");
      }
    } catch (error) {
      console.error("Failed to delete cohort:", error);
      throw error;
    }
  }

  async getByAccessCode(accessCode: string): Promise<CachedCohort | null> {
    try {
      const response = await fetch(`/api/cohort/get?accessCode=${accessCode}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch cohort");
      }

      const result = await response.json();
      const cohort = result.cohort;

      return {
        ...cohort,
        localVersion: this.generateVersion(),
        remoteVersion: 0,
        isDirty: false,
      };
    } catch (error) {
      console.error("Failed to fetch cohort by access code:", error);
      return null;
    }
  }

  getJoinLink(accessCode: string): string {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${accessCode}`;
    }
    return `/join/${accessCode}`;
  }
}

export const cohortStorage = new CohortStorage();
