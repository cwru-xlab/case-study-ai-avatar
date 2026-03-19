"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  ArrowLeft,
  Search,
  UserPlus,
  Trash2,
  Download,
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Pencil,
  ArrowUpDown,
  BookOpen,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import type { CachedCohort, CohortStudent } from "@/types/cohort";

type StudentStatus = CohortStudent["status"];
type SortField = "name" | "email" | "status" | "score" | "progress";
type SortDirection = "asc" | "desc";
type ProgressStatus = "not_started" | "in_progress" | "completed";

interface LearnerWithPerformance extends CohortStudent {
visibleName: string;
  assignedCases: number;
  completedCases: number;
  progressStatus: ProgressStatus;
  bestScore: number | null;
  avgScore: number | null;
}

const STATUS_CONFIG: Record<
  StudentStatus,
  { label: string; color: "success" | "warning" | "danger" | "default"; icon: React.ReactNode }
> = {
  joined: { label: "Joined", color: "success", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  invited: { label: "Invited", color: "warning", icon: <Clock className="w-3.5 h-3.5" /> },
  active: { label: "Active", color: "success", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  completed: { label: "Completed", color: "default", icon: <CheckCircle className="w-3.5 h-3.5" /> },
};

const PROGRESS_CONFIG: Record<
  ProgressStatus,
  { label: string; color: "success" | "warning" | "default" }
> = {
  not_started: { label: "Not Started", color: "default" },
  in_progress: { label: "In Progress", color: "warning" },
  completed: { label: "Completed", color: "success" },
};

export default function CodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;

  const [code, setCode] = useState<CachedCohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [learnerPerformance, setLearnerPerformance] = useState<Record<string, {
    assignedCases: number;
    completedCases: number;
    bestScore: number | null;
    avgScore: number | null;
  }>>({});
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  useEffect(() => {
    loadCode();
  }, [codeId]);

  const loadCode = async () => {
    try {
      setLoading(true);
      const data = await cohortStorage.get(codeId);
      if (data) {
        setCode(data);
        if (data.students && data.students.length > 0) {
          loadLearnerPerformance(data);
        }
      } else {
        addToast({ title: "Cohort not found", color: "danger" });
        router.push("/codes");
      }
    } catch (err) {
      console.error("Failed to load code:", err);
      addToast({ title: "Failed to load cohort", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const loadLearnerPerformance = async (codeData: CachedCohort) => {
    if (!codeData.students || codeData.students.length === 0) return;
    
    setLoadingPerformance(true);
    try {
      const res = await fetch(`/api/codes/${codeData.id}/learner-performance`);
      if (res.ok) {
        const data = await res.json();
        setLearnerPerformance(data.performance || {});
      }
    } catch (err) {
      console.error("Failed to load learner performance:", err);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const learnersWithPerformance: LearnerWithPerformance[] = useMemo(() => {
    if (!code?.students) return [];
    
    return code.students.map((student) => {
      const perf = learnerPerformance[student.email] || {
        assignedCases: code.assignedCaseIds?.length || 0,
        completedCases: 0,
        bestScore: null,
        avgScore: null,
      };

      let progressStatus: ProgressStatus = "not_started";
      if (perf.completedCases > 0 && perf.completedCases >= perf.assignedCases) {
        progressStatus = "completed";
      } else if (perf.completedCases > 0) {
        progressStatus = "in_progress";
      }

      return {
        ...student,
        visibleName: student.name || student.email.split("@")[0],
        assignedCases: perf.assignedCases,
        completedCases: perf.completedCases,
        progressStatus,
        bestScore: perf.bestScore,
        avgScore: perf.avgScore,
      };
    });
  }, [code?.students, code?.assignedCaseIds, learnerPerformance]);

  const filteredAndSortedLearners = useMemo(() => {
    let filtered = learnersWithPerformance;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.email.toLowerCase().includes(query) ||
          s.visibleName.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.visibleName.localeCompare(b.visibleName);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "score":
          const scoreA = a.bestScore ?? -1;
          const scoreB = b.bestScore ?? -1;
          cmp = scoreA - scoreB;
          break;
        case "progress":
          const progressOrder = { not_started: 0, in_progress: 1, completed: 2 };
          cmp = progressOrder[a.progressStatus] - progressOrder[b.progressStatus];
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [learnersWithPerformance, searchQuery, sortField, sortDirection]);

  const studentStats = useMemo(() => {
    const learners = learnersWithPerformance;
    return {
      total: learners.length,
      active: learners.filter((s) => s.status === "active" || s.status === "joined").length,
      completed: learners.filter((s) => s.progressStatus === "completed").length,
      inProgress: learners.filter((s) => s.progressStatus === "in_progress").length,
    };
  }, [learnersWithPerformance]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleStudentClick = (studentEmail: string) => {
    router.push(`/codes/${codeId}/student/${encodeURIComponent(studentEmail)}`);
  };

  const handleExportCSV = () => {
    if (!filteredAndSortedLearners.length) {
      addToast({ title: "No learners to export", color: "warning" });
      return;
    }

    const headers = ["Name", "Email", "Status", "Progress", "Best Score", "Completed Cases", "Assigned Cases"];
    const rows = filteredAndSortedLearners.map((s) => [
      s.visibleName,
      s.email,
      s.status,
      s.progressStatus,
      s.bestScore !== null ? s.bestScore.toString() : "N/A",
      s.completedCases.toString(),
      s.assignedCases.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${code?.name.replace(/\s+/g, "_")}_learners.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast({ title: "CSV exported", color: "success" });
  };

  const handleBack = () => router.push("/codes");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading cohort details..." />
      </div>
    );
  }

  if (!code) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Cohort not found</p>
          <Button className="mt-4" onPress={handleBack}>Back to Cohorts</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={pageTitle()}>{code.name}</h1>
          <p className="text-default-500 text-sm">Manage learners and view performance</p>
        </div>
        <Button
          variant="bordered"
          startContent={<Pencil className="w-4 h-4" />}
          onPress={() => router.push(`/codes/${codeId}/edit`)}
        >
          Edit Cohort
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.total}</p>
              <p className="text-xs text-default-500">Total Learners</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.active}</p>
              <p className="text-xs text-default-500">Active</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.inProgress}</p>
              <p className="text-xs text-default-500">In Progress</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Trophy className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.completed}</p>
              <p className="text-xs text-default-500">Completed</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Input
          placeholder="Search by email or name..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          startContent={<Search className="w-4 h-4 text-default-400" />}
          className="w-full sm:w-80"
          isClearable
          onClear={() => setSearchQuery("")}
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="bordered"
            size="sm"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadCode}
          >
            Refresh
          </Button>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExportCSV}
            isDisabled={!filteredAndSortedLearners.length}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Learners Table */}
      <Card>
        <CardBody className="p-0">
          {filteredAndSortedLearners.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-default-300 mb-4" />
              {searchQuery ? (
                <>
                  <p className="text-default-500">No learners match your search</p>
                  <Button variant="light" size="sm" className="mt-2" onPress={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                </>
              ) : (
                <p className="text-default-500">No learners in this cohort yet</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-default-100">
                  <tr>
                    <th
                      className="text-left p-4 font-medium cursor-pointer hover:bg-default-200"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        <ArrowUpDown size={14} className={sortField === "name" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                    <th
                      className="text-left p-4 font-medium cursor-pointer hover:bg-default-200"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center gap-2">
                        Email
                        <ArrowUpDown size={14} className={sortField === "email" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                    <th
                      className="text-left p-4 font-medium cursor-pointer hover:bg-default-200"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        Enrollment
                        <ArrowUpDown size={14} className={sortField === "status" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                    <th
                      className="text-left p-4 font-medium cursor-pointer hover:bg-default-200"
                      onClick={() => handleSort("progress")}
                    >
                      <div className="flex items-center gap-2">
                        Progress
                        <ArrowUpDown size={14} className={sortField === "progress" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                    <th
                      className="text-right p-4 font-medium cursor-pointer hover:bg-default-200"
                      onClick={() => handleSort("score")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Best Score
                        <ArrowUpDown size={14} className={sortField === "score" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                    <th className="text-center p-4 font-medium">Cases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {filteredAndSortedLearners.map((learner) => {
                    const statusConfig = STATUS_CONFIG[learner.status];
                    const progressConfig = PROGRESS_CONFIG[learner.progressStatus];
                    return (
                      <tr
                        key={learner.email}
                        className="hover:bg-default-50 cursor-pointer"
                        onClick={() => handleStudentClick(learner.email)}
                      >
                        <td className="p-4">
                          <span className="text-primary hover:underline font-medium">
                            {learner.visibleName}
                          </span>
                        </td>
                        <td className="p-4 text-default-600">{learner.email}</td>
                        <td className="p-4">
                          <Chip
                            size="sm"
                            color={statusConfig.color}
                            variant="flat"
                            startContent={statusConfig.icon}
                          >
                            {statusConfig.label}
                          </Chip>
                        </td>
                        <td className="p-4">
                          <Chip size="sm" color={progressConfig.color} variant="flat">
                            {progressConfig.label}
                          </Chip>
                        </td>
                        <td className="p-4 text-right">
                          {learner.bestScore !== null ? (
                            <Chip
                              size="sm"
                              color={learner.bestScore >= 70 ? "success" : "warning"}
                              variant="flat"
                            >
                              {learner.bestScore}
                            </Chip>
                          ) : (
                            <span className="text-default-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center text-default-600">
                          {learner.completedCases}/{learner.assignedCases}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Code Info */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Cohort Details</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-default-500">Access Mode</span>
            <Chip
              size="sm"
              variant="bordered"
              color={code.accessMode === "anyone" ? "success" : "warning"}
            >
              {code.accessMode === "anyone" ? "Open Access" : "Restricted"}
            </Chip>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-default-500">Access Code</span>
            <code className="font-mono text-primary font-bold">{code.accessCode}</code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-default-500">Status</span>
            <Chip size="sm" variant="flat" color={code.isActive ? "success" : "default"}>
              {code.isActive ? "Active" : "Inactive"}
            </Chip>
          </div>
          {code.assignedCaseIds && code.assignedCaseIds.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-default-500">Assigned Cases</span>
              <span>{code.assignedCaseIds.length} case(s)</span>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
