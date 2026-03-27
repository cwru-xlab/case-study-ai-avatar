import type { CaseStudy } from "@/types";

class CaseStorage {
  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async add(
    caseData: Omit<CaseStudy, "id" | "createdAt" | "lastEditedAt">
  ): Promise<CaseStudy> {
    const id = this.generateId(caseData.name);

    if (id === "new") {
      throw new Error('Case name cannot generate "new" as ID');
    }

    const now = new Date().toISOString();
    const caseStudy: CaseStudy = {
      ...caseData,
      id,
      createdAt: now,
      lastEditedAt: now,
    };

    const response = await fetch("/api/case/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(caseStudy),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create case");
    }

    return caseStudy;
  }

  async update(id: string, updates: Partial<CaseStudy>): Promise<CaseStudy> {
    const response = await fetch("/api/case/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, caseStudy: updates }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update case");
    }

    const result = await response.json();
    return result.caseStudy;
  }

  async get(id: string): Promise<CaseStudy | null> {
    const response = await fetch(`/api/case/get?id=${encodeURIComponent(id)}`);

    if (response.status === 404) return null;
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to fetch case");
    }

    const result = await response.json();
    return result.caseStudy;
  }

  async list(): Promise<CaseStudy[]> {
    const response = await fetch("/api/case/list");

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to list cases");
    }

    const result = await response.json();
    return result.cases || [];
  }

  async delete(id: string): Promise<void> {
    const response = await fetch("/api/case/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete case");
    }
  }
}

export const caseStorage = new CaseStorage();
