"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Plus, RefreshCw } from "lucide-react";
import { title } from "@/components/primitives";
import CohortCard from "@/components/cohort-card";
import { cohortStorage } from "@/lib/cohort-storage";
import type { CachedCohort } from "@/types/cohort";

export default function CohortManagementPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<CachedCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCohorts();
  }, []);

  const loadCohorts = async () => {
    try {
      setLoading(true);
      setError(null);
      const cohortList = await cohortStorage.list();
      setCohorts(cohortList);
    } catch (err) {
      console.error("Failed to load cohorts:", err);
      setError("Failed to load cohorts");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const cohortList = await cohortStorage.list();
      setCohorts(cohortList);
    } catch (err) {
      console.error("Failed to sync cohorts:", err);
      setError("Failed to sync cohorts");
    } finally {
      setSyncing(false);
    }
  };

  const handleCohortClick = (cohortId: string) => {
    router.push(`/cohort-management/edit/${cohortId}`);
  };

  const handleAddCohort = () => {
    router.push("/cohort-management/edit/new");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>Cohort Management</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleSync}
            isLoading={syncing}
            className="self-start sm:self-auto"
          >
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCohort}
            className="self-start sm:self-auto"
          >
            Add Cohort
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
          <p className="text-default-500">Loading cohorts...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cohorts.map((cohort) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              onClick={handleCohortClick}
              isDirty={cohort.isDirty}
            />
          ))}
        </div>
      )}

      {!loading && cohorts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No cohorts found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCohort}
          >
            Create your first cohort
          </Button>
        </div>
      )}
    </div>
  );
}
