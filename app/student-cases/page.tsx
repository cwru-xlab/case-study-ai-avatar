"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Briefcase, BookOpen, Users, RefreshCw } from "lucide-react";

import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import type { CaseStudy } from "@/types";

interface StudentCaseWithCohort extends CaseStudy {
  cohortId?: string;
  cohortName?: string;
}

interface StudentCohort {
  id: string;
  name: string;
  assignedCaseIds: string[];
}

export default function StudentCasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<StudentCaseWithCohort[]>([]);
  const [cohorts, setCohorts] = useState<StudentCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    if (!user?.email) {
      console.log("[Student Cases] No user email found");
      setLoading(false);
      return;
    }

    console.log("[Student Cases] Loading cases for email:", user.email);

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/student/cases?email=${encodeURIComponent(user.email)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch cases");
      }

      const data = await response.json();
      console.log("[Student Cases] API response:", data);
      setCases(data.cases || []);
      setCohorts(data.cohorts || []);
    } catch (err) {
      console.error("Error loading cases:", err);
      setError("Failed to load your cases. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [user?.email]);

  const handleCaseClick = (caseId: string) => {
    router.push(`/case/${caseId}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className={title()}>
            {user?.name ? `${user.name}'s Cases` : "My Cases"}
          </h1>
          <p className="text-default-500">
            View your assigned cases from your enrolled cohorts.
          </p>
        </div>
        <Button
          variant="bordered"
          startContent={<RefreshCw className="w-4 h-4" />}
          onPress={loadCases}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Enrolled Cohorts Summary */}
      {cohorts.length > 0 && (
        <Card className="bg-default-50">
          <CardBody>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-default-500" />
              <span className="text-sm font-medium">Your Cohorts</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cohorts.map((cohort) => (
                <Chip key={cohort.id} variant="flat" color="primary" size="sm">
                  {cohort.name} ({cohort.assignedCaseIds.length} case
                  {cohort.assignedCaseIds.length !== 1 ? "s" : ""})
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <Card className="bg-default-50">
          <CardBody className="py-12 text-center">
            <p className="text-default-500">Loading your cases...</p>
          </CardBody>
        </Card>
      ) : error ? (
        <Card className="bg-danger-50">
          <CardBody className="py-12 text-center">
            <p className="text-danger-600">{error}</p>
            <Button
              className="mt-4"
              color="primary"
              variant="flat"
              onPress={loadCases}
            >
              Try Again
            </Button>
          </CardBody>
        </Card>
      ) : cases.length === 0 ? (
        <Card className="bg-default-50">
          <CardBody className="py-12 text-center">
            <Briefcase className="mx-auto mb-4 text-default-300" size={48} />
            <p className="text-default-500">
              {cohorts.length === 0
                ? "You haven't joined any cohorts yet. Use a cohort access code to join."
                : "No cases assigned yet. Cases will appear here once your instructor assigns them to your cohort."}
            </p>
            {user?.email && cohorts.length === 0 && (
              <p className="text-xs text-default-400 mt-2">
                Looking for cohorts with email: <code className="font-mono">{user.email}</code>
              </p>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <Card
              key={caseItem.id}
              isPressable
              className="hover:shadow-lg transition-shadow"
              onPress={() => handleCaseClick(caseItem.id)}
            >
              <CardHeader className="flex gap-3 pb-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <BookOpen className="text-primary" size={20} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {caseItem.name}
                  </p>
                  {caseItem.cohortName && (
                    <p className="text-xs text-default-500">
                      {caseItem.cohortName}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                <p className="text-sm text-default-600 line-clamp-3 mb-4">
                  {caseItem.backgroundInfo}
                </p>
                <div className="flex items-center gap-2 text-xs text-default-400">
                  {caseItem.avatars && caseItem.avatars.length > 0 && (
                    <Chip size="sm" variant="flat">
                      {caseItem.avatars.length} Avatar
                      {caseItem.avatars.length !== 1 ? "s" : ""}
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
