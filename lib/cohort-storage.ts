import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  Cohort,
  CohortCreateInput,
  CohortUpdateInput,
  CachedCohort,
} from "@/types/cohort";

interface CohortDB extends DBSchema {
  cohorts: {
    key: string;
    value: CachedCohort;
    indexes: { "by-professor": string; "by-case": string };
  };
  metadata: {
    key: string;
    value: any;
  };
}

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
  private db: IDBPDatabase<CohortDB> | null = null;
  private initialized = false;

  private async initDB(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<CohortDB>("cohort-cache", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cohorts")) {
          const store = db.createObjectStore("cohorts", { keyPath: "id" });
          store.createIndex("by-professor", "professorId");
          store.createIndex("by-case", "caseId");
        }

        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata");
        }
      },
    });

    this.initialized = true;
  }

  private async ensureDB(): Promise<IDBPDatabase<CohortDB>> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  private generateVersion(): number {
    return Date.now();
  }

  async add(input: CohortCreateInput): Promise<Cohort> {
    const db = await this.ensureDB();

    const id = generateId(input.name);
    const accessCode = generateAccessCode();
    const now = new Date().toISOString();
    const version = this.generateVersion();

    const cohort: Cohort = {
      ...input,
      id,
      accessCode,
      createdAt: now,
      updatedAt: now,
    };

    const cachedCohort: CachedCohort = {
      ...cohort,
      localVersion: version,
      remoteVersion: 0,
      isDirty: true,
    };

    await db.put("cohorts", cachedCohort);

    try {
      const response = await fetch("/api/professor/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cohort),
      });

      if (!response.ok) {
        throw new Error(`Failed to create cohort: ${response.statusText}`);
      }

      const result = await response.json();

      cachedCohort.remoteVersion = result.version;
      cachedCohort.isDirty = false;
      await db.put("cohorts", cachedCohort);

      return cohort;
    } catch (error) {
      console.error("Failed to save cohort to server:", error);
      return cohort;
    }
  }

  async updateLocal(id: string, updates: CohortUpdateInput): Promise<void> {
    const db = await this.ensureDB();

    const existing = await db.get("cohorts", id);
    if (!existing) {
      throw new Error(`Cohort ${id} not found`);
    }

    const now = new Date().toISOString();
    const version = this.generateVersion();

    const updatedCohort: CachedCohort = {
      ...existing,
      ...updates,
      updatedAt: now,
      localVersion: version,
      isDirty: true,
    };

    await db.put("cohorts", updatedCohort);
  }

  async save(id: string): Promise<Cohort> {
    const db = await this.ensureDB();

    const cached = await db.get("cohorts", id);
    if (!cached) {
      throw new Error(`Cohort ${id} not found`);
    }

    if (!cached.isDirty) {
      return cached;
    }

    try {
      const response = await fetch(`/api/professor/cohorts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort: cached,
          expectedVersion: cached.remoteVersion,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to save cohort: ${error.error}`);
      }

      const result = await response.json();

      cached.remoteVersion = result.version;
      cached.isDirty = false;
      await db.put("cohorts", cached);

      return cached;
    } catch (error) {
      console.error("Failed to save cohort to server:", error);
      throw error;
    }
  }

  async list(professorId?: string): Promise<CachedCohort[]> {
    const db = await this.ensureDB();

    try {
      const url = professorId
        ? `/api/professor/cohorts?professorId=${professorId}`
        : "/api/professor/cohorts";
      const response = await fetch(url);

      if (!response.ok) {
        console.warn("Failed to fetch cohorts from server");
        const localCohorts = await db.getAll("cohorts");
        return professorId
          ? localCohorts.filter((c) => c.professorId === professorId)
          : localCohorts;
      }

      const cohorts: Cohort[] = await response.json();

      for (const cohort of cohorts) {
        const existing = await db.get("cohorts", cohort.id);
        if (!existing || !existing.isDirty) {
          const cached: CachedCohort = {
            ...cohort,
            localVersion: this.generateVersion(),
            remoteVersion: (cohort as any).version || 0,
            isDirty: false,
          };
          await db.put("cohorts", cached);
        }
      }

      return await db.getAll("cohorts");
    } catch (error) {
      console.error("Failed to fetch cohorts:", error);
      const localCohorts = await db.getAll("cohorts");
      return professorId
        ? localCohorts.filter((c) => c.professorId === professorId)
        : localCohorts;
    }
  }

  async get(id: string): Promise<CachedCohort | null> {
    const db = await this.ensureDB();

    try {
      const response = await fetch(`/api/professor/cohorts/${id}`);

      if (response.ok) {
        const cohort = await response.json();
        const cached: CachedCohort = {
          ...cohort,
          localVersion: this.generateVersion(),
          remoteVersion: cohort.version || 0,
          isDirty: false,
        };
        await db.put("cohorts", cached);
        return cached;
      }
    } catch (error) {
      console.error("Failed to fetch cohort from server:", error);
    }

    return (await db.get("cohorts", id)) || null;
  }

  async delete(id: string): Promise<void> {
    const db = await this.ensureDB();

    try {
      const response = await fetch(`/api/professor/cohorts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete cohort: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to delete cohort from server:", error);
      throw error;
    }

    await db.delete("cohorts", id);
  }

  async getByAccessCode(accessCode: string): Promise<CachedCohort | null> {
    const db = await this.ensureDB();
    const all = await db.getAll("cohorts");
    return all.find((c) => c.accessCode === accessCode) || null;
  }

  async addStudent(id: string, email: string): Promise<void> {
    const db = await this.ensureDB();
    const cohort = await db.get("cohorts", id);

    if (!cohort) {
      throw new Error(`Cohort ${id} not found`);
    }

    const existingStudent = cohort.students.find((s) => s.email === email);
    if (existingStudent) {
      return;
    }

    cohort.students.push({
      email,
      status: "invited",
    });
    cohort.updatedAt = new Date().toISOString();
    cohort.localVersion = this.generateVersion();
    cohort.isDirty = true;

    await db.put("cohorts", cohort);
  }

  async removeStudent(id: string, email: string): Promise<void> {
    const db = await this.ensureDB();
    const cohort = await db.get("cohorts", id);

    if (!cohort) {
      throw new Error(`Cohort ${id} not found`);
    }

    cohort.students = cohort.students.filter((s) => s.email !== email);
    cohort.updatedAt = new Date().toISOString();
    cohort.localVersion = this.generateVersion();
    cohort.isDirty = true;

    await db.put("cohorts", cohort);
  }

  getJoinLink(accessCode: string): string {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${accessCode}`;
    }
    return `/join/${accessCode}`;
  }
}

export const cohortStorage = new CohortStorage();
