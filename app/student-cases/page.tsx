"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Briefcase, Users, RefreshCw, UserPlus, X, Video } from "lucide-react";
import { addToast } from "@heroui/toast";

import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import type { CaseStudy } from "@/types";
import type { Cohort } from "@/types/cohort";

interface StudentCaseWithCohort extends CaseStudy {
  cohortId?: string;
  cohortName?: string;
  heygenMinutesLimit?: number | null;
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
  const [avatarSecondsUsed, setAvatarSecondsUsed] = useState<Record<string, number>>({});

  // Pending cohort join state
  const [pendingCohort, setPendingCohort] = useState<Cohort | null>(null);
  const [pendingAccessCode, setPendingAccessCode] = useState<string | null>(null);
  const [joiningCohort, setJoiningCohort] = useState(false);

  // Check for pending cohort join on mount
  useEffect(() => {
    const savedAccessCode = localStorage.getItem("pendingCohortJoin");
    if (savedAccessCode) {
      setPendingAccessCode(savedAccessCode);
      fetchPendingCohort(savedAccessCode);
    }
  }, []);

  const fetchPendingCohort = async (accessCode: string) => {
    try {
      const response = await fetch(`/api/cohort/get?accessCode=${accessCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.cohort) {
          setPendingCohort(data.cohort);
        } else {
          // Invalid access code, clear it
          localStorage.removeItem("pendingCohortJoin");
          setPendingAccessCode(null);
        }
      } else {
        localStorage.removeItem("pendingCohortJoin");
        setPendingAccessCode(null);
      }
    } catch (err) {
      console.error("Error fetching pending cohort:", err);
      localStorage.removeItem("pendingCohortJoin");
      setPendingAccessCode(null);
    }
  };

  const handleJoinPendingCohort = async () => {
    if (!user?.email || !pendingAccessCode) return;

    setJoiningCohort(true);
    try {
      const response = await fetch("/api/cohort/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: pendingAccessCode,
          email: user.email.trim().toLowerCase(),
          name: user.name || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join cohort");
      }

      // Clear pending state
      localStorage.removeItem("pendingCohortJoin");
      setPendingCohort(null);
      setPendingAccessCode(null);

      addToast({
        title: "Success!",
        description: `You have joined ${pendingCohort?.name}`,
        color: "success",
      });

      // Reload cases to show the new cohort
      loadCases();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join cohort";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setJoiningCohort(false);
    }
  };

  const handleDismissPendingCohort = () => {
    localStorage.removeItem("pendingCohortJoin");
    setPendingCohort(null);
    setPendingAccessCode(null);
  };

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
      const loadedCases: StudentCaseWithCohort[] = data.cases || [];
      setCases(loadedCases);
      setCohorts(data.cohorts || []);

      // Fetch used avatar time for cases that have a minutes limit
      const casesWithLimit = loadedCases.filter((c) => c.heygenMinutesLimit != null && c.cohortId);
      if (casesWithLimit.length > 0) {
        const results = await Promise.all(
          casesWithLimit.map((c) =>
            fetch(`/api/interaction/avatar-time?studentEmail=${encodeURIComponent(user.email!)}&caseId=${encodeURIComponent(c.id)}`)
              .then((r) => r.ok ? r.json() : { usedSeconds: 0 })
              .then((d) => ({ caseId: c.id, usedSeconds: d.usedSeconds ?? 0 }))
              .catch(() => ({ caseId: c.id, usedSeconds: 0 }))
          )
        );
        const usedMap: Record<string, number> = {};
        for (const r of results) usedMap[r.caseId] = r.usedSeconds;
        setAvatarSecondsUsed(usedMap);
      }
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

  const handleCaseClick = (caseId: string, cohortId?: string) => {
    const url = cohortId
      ? `/case-play/${caseId}?cohortId=${encodeURIComponent(cohortId)}`
      : `/case-play/${caseId}`;
    router.push(url);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Pending Cohort Join Card */}
      {pendingCohort && (
        <Card className="bg-primary-50 border-2 border-primary-200">
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 rounded-full">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary-800">
                  Join {pendingCohort.name}?
                </h3>
                {pendingCohort.description && (
                  <p className="text-sm text-primary-700 mt-1">
                    {pendingCohort.description}
                  </p>
                )}
                {pendingCohort.professorName && (
                  <p className="text-xs text-primary-600 mt-1">
                    Instructor: {pendingCohort.professorName}
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    color="primary"
                    size="sm"
                    isLoading={joiningCohort}
                    onPress={handleJoinPendingCohort}
                  >
                    {joiningCohort ? "Joining..." : "Join This Cohort"}
                  </Button>
                  <Button
                    variant="light"
                    size="sm"
                    onPress={handleDismissPendingCohort}
                  >
                    Not Now
                  </Button>
                </div>
              </div>
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={handleDismissPendingCohort}
                className="text-primary-400"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

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
              className="h-full hover:shadow-lg transition-all duration-200 overflow-hidden"
              onPress={() => handleCaseClick(caseItem.id, caseItem.cohortId)}
            >
              {/* Cover image */}
              <div
                className="relative h-32 bg-gradient-to-br from-primary-500 to-primary-700"
                style={caseItem.coverImage ? {
                  backgroundImage: `url(${caseItem.coverImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                } : undefined}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-white font-semibold text-lg truncate drop-shadow-md">
                      {caseItem.name}
                    </h3>
                  </div>
                </div>
              </div>
              <CardBody className="pt-3">
                {caseItem.cohortName && (
                  <p className="text-xs text-default-400 mb-1">{caseItem.cohortName}</p>
                )}
                <p className="text-sm text-default-600 line-clamp-2 mb-3">
                  {caseItem.backgroundInfo}
                </p>
                <div className="flex items-center gap-2 text-xs text-default-400 flex-wrap">
                  {caseItem.avatars && caseItem.avatars.length > 0 && (
                    <Chip size="sm" variant="flat">
                      {caseItem.avatars.length} Avatar
                      {caseItem.avatars.length !== 1 ? "s" : ""}
                    </Chip>
                  )}
                  {caseItem.heygenMinutesLimit != null && (() => {
                    const limitSec = caseItem.heygenMinutesLimit * 60;
                    const usedSec = avatarSecondsUsed[caseItem.id] ?? 0;
                    const remainingSec = Math.max(0, limitSec - usedSec);
                    const exhausted = remainingSec === 0;
                    const label = exhausted
                      ? "No avatar time left"
                      : remainingSec < 60
                        ? `${remainingSec}s avatar left`
                        : `${Math.floor(remainingSec / 60)}m avatar left`;
                    return (
                      <Chip
                        size="sm"
                        variant="flat"
                        color={exhausted ? "danger" : "warning"}
                        startContent={<Video className="w-3 h-3" />}
                      >
                        {label}
                      </Chip>
                    );
                  })()}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
