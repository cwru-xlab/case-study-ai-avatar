"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Users, Calendar, AlertCircle } from "lucide-react";
import type { CachedCohort } from "@/types/cohort";
import { COHORT_MODE_LABELS } from "@/types/cohort";

interface CohortCardProps {
  cohort: CachedCohort;
  onClick: (cohortId: string) => void;
  isDirty?: boolean;
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

function getCohortStatus(cohort: CachedCohort): {
  label: string;
  color: "success" | "warning" | "danger" | "default";
} {
  const now = new Date();
  const start = new Date(cohort.startDate);
  const end = new Date(cohort.endDate);

  if (!cohort.isActive) {
    return { label: "Inactive", color: "default" };
  }
  if (now < start) {
    return { label: "Upcoming", color: "warning" };
  }
  if (now > end) {
    return { label: "Ended", color: "danger" };
  }
  return { label: "Active", color: "success" };
}

export default function CohortCard({
  cohort,
  onClick,
  isDirty,
}: CohortCardProps) {
  const handleCardClick = () => {
    onClick(cohort.id);
  };

  const status = getCohortStatus(cohort);
  const studentCount = cohort.students?.length || 0;
  const activeStudents = cohort.students?.filter(
    (s) => s.status === "active" || s.status === "joined"
  ).length || 0;

  return (
    <Card
      className="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200"
      isPressable
      onPress={handleCardClick}
    >
      <CardHeader className="flex gap-3">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-md font-semibold">{cohort.name}</p>
            <Chip
              size="sm"
              color={status.color}
              variant="solid"
            >
              {status.label}
            </Chip>
            {(isDirty || cohort.isDirty) && (
              <div className="flex items-center gap-1 text-warning">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">Unsaved</span>
              </div>
            )}
          </div>
          <p className="text-small text-default-500 font-mono">
            Code: {cohort.accessCode}
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          {cohort.description && (
            <p className="text-sm text-default-600 line-clamp-2">
              {cohort.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Chip size="sm" variant="flat" startContent={<Users className="w-3 h-3" />}>
              {activeStudents}/{studentCount} students
            </Chip>
          </div>

          <div className="flex items-center gap-2 text-xs text-default-500">
            <Calendar className="w-3 h-3" />
            <span>
              {new Date(cohort.startDate).toLocaleDateString()} - {new Date(cohort.endDate).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Chip size="sm" variant="bordered">
              {COHORT_MODE_LABELS[cohort.cohortMode]}
            </Chip>
            {cohort.caseName && (
              <Chip size="sm" variant="flat" color="secondary">
                {cohort.caseName}
              </Chip>
            )}
          </div>

          <div className="pt-2 border-t border-default-200">
            <p className="text-xs text-default-400">
              Last updated {getRelativeTime(cohort.updatedAt)}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
