"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Plus, RefreshCw, Users, Calendar, DollarSign, Trash2, Eye } from "lucide-react";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import type { CachedCohort } from "@/types/cohort";
import { COHORT_MODE_LABELS } from "@/types/cohort";

export default function CohortsListPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<CachedCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCohorts();
  }, []);

  const loadCohorts = async () => {
    try {
      const data = await cohortStorage.list();
      setCohorts(data);
    } catch (error) {
      console.error("Error loading cohorts:", error);
      addToast({
        title: "Error",
        description: "Failed to load cohorts",
        color: "danger",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCohorts();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await cohortStorage.delete(id);
      addToast({
        title: "Success",
        description: "Cohort deleted successfully",
        color: "success",
      });
      loadCohorts();
    } catch (error) {
      console.error("Error deleting cohort:", error);
      addToast({
        title: "Error",
        description: "Failed to delete cohort",
        color: "danger",
      });
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "practice":
        return "default";
      case "graded":
        return "primary";
      case "competitive":
        return "warning";
      case "simulation":
        return "danger";
      default:
        return "default";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-default-500">Loading cohorts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>My Cohorts</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleRefresh}
            isLoading={refreshing}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            startContent={<Plus className="w-4 h-4" />}
            onPress={() => router.push("/professor/cohorts/create")}
          >
            Create Cohort
          </Button>
        </div>
      </div>

      {/* Cohorts Grid */}
      {cohorts.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-default-300" />
            <h3 className="text-lg font-semibold mb-2">No Cohorts Yet</h3>
            <p className="text-default-500 mb-4">
              Create your first cohort to get started with student management.
            </p>
            <Button
              color="primary"
              startContent={<Plus className="w-4 h-4" />}
              onPress={() => router.push("/professor/cohorts/create")}
            >
              Create First Cohort
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cohorts.map((cohort) => (
            <Card
              key={cohort.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              isPressable
              onPress={() => router.push(`/professor/cohorts/${cohort.id}`)}
            >
              <CardHeader className="flex justify-between items-start pb-2">
                <div>
                  <h3 className="font-semibold text-lg">{cohort.name}</h3>
                  <p className="text-small text-default-500">
                    Code: {cohort.accessCode}
                  </p>
                </div>
                <Chip size="sm" color={getModeColor(cohort.cohortMode)}>
                  {COHORT_MODE_LABELS[cohort.cohortMode]}
                </Chip>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="space-y-3">
                  {/* Students */}
                  <div className="flex items-center gap-2 text-small">
                    <Users className="w-4 h-4 text-default-400" />
                    <span>{cohort.students.length} students</span>
                  </div>

                  {/* Budget */}
                  <div className="flex items-center gap-2 text-small">
                    <DollarSign className="w-4 h-4 text-default-400" />
                    <span>${cohort.budgetPerStudent} per student</span>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center gap-2 text-small">
                    <Calendar className="w-4 h-4 text-default-400" />
                    <span>
                      {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                    </span>
                  </div>

                  {/* Enabled Modes */}
                  <div className="flex gap-1 flex-wrap">
                    {cohort.enabledModes.video && (
                      <Chip size="sm" variant="flat">Video</Chip>
                    )}
                    {cohort.enabledModes.voice && (
                      <Chip size="sm" variant="flat">Voice</Chip>
                    )}
                    {cohort.enabledModes.text && (
                      <Chip size="sm" variant="flat">Text</Chip>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Eye className="w-3 h-3" />}
                      onPress={() => {
                        router.push(`/professor/cohorts/${cohort.id}`);
                      }}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      startContent={<Trash2 className="w-3 h-3" />}
                      onPress={() => {
                        handleDelete(cohort.id, cohort.name);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
