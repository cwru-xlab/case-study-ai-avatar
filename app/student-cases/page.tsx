"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import {
  Briefcase,
  Plus,
  Calendar,
  User,
  Users,
  X,
} from "lucide-react";

import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import type { CaseAvatar } from "@/types";

interface StudentCase {
  id: string;
  name: string;
  backgroundInfo: string;
  avatars: CaseAvatar[];
  cohortName: string;
  cohortCode: string;
  attemptCount: number;
  bestScore: number | null;
  latestScore: number | null;
  status: "not_started" | "in_progress" | "completed";
  assignedAt: string | null;
}

type StatusFilter = "all" | "not_started" | "in_progress" | "completed";

const statusConfig = {
  not_started: { label: "Not Started", color: "default" as const },
  in_progress: { label: "In Progress", color: "primary" as const },
  completed: { label: "Completed", color: "success" as const },
};

export default function StudentCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<StudentCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseCode, setCaseCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    async function fetchCases() {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/student/cases?email=${encodeURIComponent(user.email)}`
        );
        const data = await response.json();

        if (data.success) {
          setCases(data.cases);
        } else {
          setError(data.error || "Failed to load cases");
        }
      } catch (err) {
        setError("Failed to load cases");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCases();
  }, [user?.email]);

  const courses = useMemo(() => {
    const uniqueCourses = new Map<string, string>();
    cases.forEach((c) => {
      if (c.cohortCode) {
        uniqueCourses.set(c.cohortCode, c.cohortName);
      }
    });
    return Array.from(uniqueCourses.entries()).map(([code, name]) => ({
      code,
      name,
    }));
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (courseFilter !== "all" && c.cohortCode !== courseFilter) {
        return false;
      }

      if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [cases, courseFilter, statusFilter]);

  const hasActiveFilters = courseFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setCourseFilter("all");
    setStatusFilter("all");
  };

  const handleAddCase = () => {
    if (!caseCode.trim()) return;
    setIsAdding(true);
    setTimeout(() => {
      setCaseCode("");
      setIsAdding(false);
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner size="lg" />
        <p className="text-default-500">Loading your cases...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className={title()}>
          {user?.name ? `${user.name}'s Cases` : "My Cases"}
        </h1>
        <p className="text-default-500">
          View your assigned cases and track your progress.
        </p>
      </div>

      <Card className="bg-default-50">
        <CardBody className="gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              className="flex-1"
              placeholder="Enter case code or link (e.g., MGMT-401-A)"
              value={caseCode}
              onChange={(e) => setCaseCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCase()}
            />
            <Button
              color="primary"
              isLoading={isAdding}
              startContent={!isAdding && <Plus size={18} />}
              onPress={handleAddCase}
            >
              Add Case
            </Button>
          </div>
          {cases.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-default-200">
              <Select
                className="flex-1 sm:flex-none sm:w-48"
                label="Course"
                placeholder="All courses"
                selectedKeys={[courseFilter]}
                onChange={(e) => setCourseFilter(e.target.value || "all")}
                size="sm"
              >
                {[
                  <SelectItem key="all">All courses</SelectItem>,
                  ...courses.map((course) => (
                    <SelectItem key={course.code}>{course.code}</SelectItem>
                  )),
                ]}
              </Select>
              <Select
                className="flex-1 sm:flex-none sm:w-40"
                label="Status"
                placeholder="All statuses"
                selectedKeys={[statusFilter]}
                onChange={(e) =>
                  setStatusFilter((e.target.value as StatusFilter) || "all")
                }
                size="sm"
              >
                <SelectItem key="all">All statuses</SelectItem>
                <SelectItem key="not_started">Not Started</SelectItem>
                <SelectItem key="in_progress">In Progress</SelectItem>
                <SelectItem key="completed">Completed</SelectItem>
              </Select>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="light"
                  className="self-end"
                  startContent={<X size={14} />}
                  onPress={clearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {error && (
        <Card className="bg-danger-50 border border-danger-200">
          <CardBody>
            <p className="text-danger">{error}</p>
          </CardBody>
        </Card>
      )}

      {cases.length === 0 && !error ? (
        <Card className="bg-default-50">
          <CardBody className="py-12 text-center">
            <Briefcase className="mx-auto mb-4 text-default-300" size={48} />
            <p className="text-default-500">
              No cases assigned yet. Add a case using the code above.
            </p>
          </CardBody>
        </Card>
      ) : filteredCases.length === 0 ? (
        <Card className="bg-default-50">
          <CardBody className="py-12 text-center">
            <Briefcase className="mx-auto mb-4 text-default-300" size={48} />
            <p className="text-default-500">
              No cases match your filters.
            </p>
            <Button
              variant="light"
              color="primary"
              className="mt-4"
              onPress={clearFilters}
            >
              Clear filters
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-default-500">
              Showing {filteredCases.length} of {cases.length} case
              {cases.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCases.map((caseItem) => (
              <Card
                key={caseItem.id}
                isPressable
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="flex gap-3 pb-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Briefcase className="text-primary" size={20} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {caseItem.name}
                    </p>
                    {caseItem.cohortCode && (
                      <p className="text-xs text-default-500 font-mono">
                        {caseItem.cohortCode}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full bg-${statusConfig[caseItem.status].color}/10 text-${statusConfig[caseItem.status].color}`}
                  >
                    {statusConfig[caseItem.status].label}
                  </span>
                </CardHeader>
                <CardBody className="pt-3">
                  <p className="text-sm text-default-600 line-clamp-2 mb-4">
                    {caseItem.backgroundInfo}
                  </p>
                  <div className="flex flex-col gap-2 text-xs text-default-400">
                    {caseItem.cohortName && (
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span>{caseItem.cohortName}</span>
                      </div>
                    )}
                    {caseItem.avatars.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users size={14} />
                        <span>
                          {caseItem.avatars.length} character
                          {caseItem.avatars.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    {caseItem.attemptCount > 0 && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>
                          {caseItem.attemptCount} attempt
                          {caseItem.attemptCount !== 1 ? "s" : ""}
                          {caseItem.bestScore !== null &&
                            ` · Best: ${caseItem.bestScore}%`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
