"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Plus, RefreshCw } from "lucide-react";
import { title } from "@/components/primitives";
import CaseCard from "@/components/case-card";
import { caseStorage } from "@/lib/case-storage";
import type { CaseStudy } from "@/types";

export default function CaseManagementPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const caseList = await caseStorage.list();
      setCases(caseList);
    } catch (err) {
      console.error("Failed to load cases:", err);
      setError("Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId: string) => {
    router.push(`/case-management/${caseId}`);
  };

  const handleSync = async () => {
    await loadCases();
  };

  const handleAddCase = () => {
    router.push("/case-management/new");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>Case Management</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleSync}
            isLoading={loading}
            className="self-start sm:self-auto"
          >
            {loading ? "Syncing..." : "Sync"}
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCase}
            className="self-start sm:self-auto"
          >
            Add Case
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-default-500">Loading cases...</p>
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cases.map((caseStudy) => (
            <CaseCard
              key={caseStudy.id}
              caseStudy={caseStudy}
              onClick={handleCaseClick}
            />
          ))}
        </div>
      )}

      {!loading && cases.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No cases found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCase}
          >
            Create your first case
          </Button>
        </div>
      )}
    </div>
  );
}
