"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Checkbox } from "@heroui/checkbox";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  Pencil,
  ArrowUpDown,
  BookOpen,
  Trophy,
  TrendingUp,
  Share2,
  Copy,
  Link,
  Check,
  CircleDashed,
  Plus,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import { caseStorage } from "@/lib/case-storage";
import type { CachedCohort, CohortStudent } from "@/types/cohort";
import type { CaseStudy } from "@/types";

type StudentStatus = CohortStudent["status"];
type ProgressStatus = "not_started" | "in_progress" | "completed";

interface CaseScore {
  caseId: string;
  caseName: string;
  bestScore: number | null;
  attemptCount: number;
  lastAttemptDate: string | null;
}

interface StudentGradebookEntry {
  email: string;
  name: string;
  cases: CaseScore[];
  averageScore: number | null;
  status: StudentStatus;
  progressStatus: ProgressStatus;
}

const STATUS_CONFIG: Record<
  StudentStatus,
  { label: string; color: "success" | "warning" | "danger" | "default"; icon: React.ReactNode }
> = {
  joined: { label: "Joined", color: "success", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  invited: { label: "Invited", color: "warning", icon: <Clock className="w-3.5 h-3.5" /> },
  active: { label: "Enrolled", color: "success", icon: <CheckCircle className="w-3.5 h-3.5" /> },
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

interface GradebookData {
  students: StudentGradebookEntry[];
  cases: Array<{ id: string; name: string }>;
  cohortName: string;
}

type SortField = "name" | "average" | "status" | string;
type SortDirection = "asc" | "desc";

export default function CodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;

  const [code, setCode] = useState<CachedCohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradebookData, setGradebookData] = useState<GradebookData | null>(null);
  const [loadingGradebook, setLoadingGradebook] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<"code" | "link" | null>(null);

  // Case assignment modal state
  const [assignCasesModalOpen, setAssignCasesModalOpen] = useState(false);
  const [availableCases, setAvailableCases] = useState<CaseStudy[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [assignedCaseIds, setAssignedCaseIds] = useState<string[]>([]);
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [savingCases, setSavingCases] = useState(false);

  useEffect(() => {
    loadCode();
  }, [codeId]);

  const loadCode = async () => {
    try {
      setLoading(true);
      const data = await cohortStorage.get(codeId);
      if (data) {
        setCode(data);
        loadGradebook();
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

  const loadGradebook = async () => {
    setLoadingGradebook(true);
    try {
      const res = await fetch(`/api/codes/${codeId}/gradebook`);
      if (res.ok) {
        const data = await res.json();
        setGradebookData(data);
      }
    } catch (err) {
      console.error("Failed to load gradebook:", err);
    } finally {
      setLoadingGradebook(false);
    }
  };

  const loadAvailableCases = async () => {
    setLoadingCases(true);
    try {
      const cases = await caseStorage.list();
      setAvailableCases(cases);
    } catch (err) {
      console.error("Failed to load cases:", err);
    } finally {
      setLoadingCases(false);
    }
  };

  const openAssignCasesModal = () => {
    setAssignedCaseIds(code?.assignedCaseIds || []);
    setCaseSearchQuery("");
    loadAvailableCases();
    setAssignCasesModalOpen(true);
  };

  const toggleCaseAssignment = (caseId: string) => {
    setAssignedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  const getFilteredCases = () => {
    let cases = [...availableCases];
    if (caseSearchQuery.trim()) {
      const query = caseSearchQuery.toLowerCase();
      cases = cases.filter((c) => c.name.toLowerCase().includes(query));
    }
    // Sort: assigned cases first
    cases.sort((a, b) => {
      const aAssigned = assignedCaseIds.includes(a.id) ? 0 : 1;
      const bAssigned = assignedCaseIds.includes(b.id) ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return a.name.localeCompare(b.name);
    });
    return cases;
  };

  const handleSaveCaseAssignments = async () => {
    if (!code) return;
    setSavingCases(true);
    try {
      await cohortStorage.update(codeId, {
        assignedCaseIds,
      });
      setCode({ ...code, assignedCaseIds });
      setAssignCasesModalOpen(false);
      addToast({ title: "Cases updated", color: "success" });
      loadGradebook();
    } catch (err) {
      console.error("Failed to save case assignments:", err);
      addToast({ title: "Failed to update cases", color: "danger" });
    } finally {
      setSavingCases(false);
    }
  };

  const studentStats = useMemo(() => {
    if (!gradebookData) return { total: 0, active: 0, completed: 0, inProgress: 0 };
    
    const students = gradebookData.students;
    const totalCases = gradebookData.cases.length;
    
    let completed = 0;
    let inProgress = 0;
    
    students.forEach((student) => {
      const completedCases = student.cases.filter((c) => c.bestScore !== null).length;
      if (completedCases >= totalCases && totalCases > 0) {
        completed++;
      } else if (completedCases > 0) {
        inProgress++;
      }
    });

    return {
      total: students.length,
      active: students.length,
      completed,
      inProgress,
    };
  }, [gradebookData]);

  const studentsWithStatus = useMemo(() => {
    if (!gradebookData || !code) return [];
    
    const totalCases = gradebookData.cases.length;
    
    return gradebookData.students.map((student) => {
      const cohortStudent = code.students?.find(
        (s) => s.email.toLowerCase() === student.email.toLowerCase()
      );
      
      const completedCases = student.cases.filter((c) => c.bestScore !== null).length;
      let progressStatus: ProgressStatus = "not_started";
      if (completedCases >= totalCases && totalCases > 0) {
        progressStatus = "completed";
      } else if (completedCases > 0) {
        progressStatus = "in_progress";
      }
      
      return {
        ...student,
        status: cohortStudent?.status || "invited" as StudentStatus,
        progressStatus,
      };
    });
  }, [gradebookData, code]);

  const filteredAndSortedStudents = useMemo(() => {
    if (!studentsWithStatus.length) return [];

    let filtered = studentsWithStatus;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(query));
    }

    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;

      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "average") {
        const avgA = a.averageScore ?? -1;
        const avgB = b.averageScore ?? -1;
        cmp = avgA - avgB;
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status);
      } else {
        const caseA = a.cases.find((c) => c.caseId === sortField);
        const caseB = b.cases.find((c) => c.caseId === sortField);
        const scoreA = caseA?.bestScore ?? -1;
        const scoreB = caseB?.bestScore ?? -1;
        cmp = scoreA - scoreB;
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [studentsWithStatus, searchQuery, sortField, sortDirection]);

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

  const handleScoreClick = (studentEmail: string, caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/codes/${codeId}/student/${encodeURIComponent(studentEmail)}/score/${caseId}`);
  };

  const handleExportCSV = () => {
    if (!gradebookData || filteredAndSortedStudents.length === 0) {
      addToast({ title: "No data to export", color: "warning" });
      return;
    }

    const headers = [
      "Student Name",
      "Enrollment",
      ...gradebookData.cases.map((c) => c.name),
      "Average",
    ];

    const rows = filteredAndSortedStudents.map((student) => {
      const caseScores = gradebookData.cases.map((caseInfo) => {
        const caseData = student.cases.find((c) => c.caseId === caseInfo.id);
        if (caseData?.bestScore !== null && caseData?.bestScore !== undefined) {
          return `${caseData.bestScore} (${caseData.attemptCount})`;
        }
        return caseData?.attemptCount ? `In Progress (${caseData.attemptCount})` : "Not Started";
      });

      return [
        student.name,
        STATUS_CONFIG[student.status].label,
        ...caseScores,
        student.averageScore !== null ? student.averageScore.toString() : "—",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${gradebookData.cohortName.replace(/\s+/g, "_")}_gradebook.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast({ title: "Gradebook exported", color: "success" });
  };

  const handleBack = () => router.push("/codes");

  const getJoinLink = (accessCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${accessCode}`;
    }
    return `/join/${accessCode}`;
  };

  const copyToClipboard = (text: string, field: "code" | "link") => {
    if (!text) return;

    const successMessage = field === "code" ? "Access code copied" : "Join link copied";

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedField(field);
          addToast({
            title: "Copied",
            description: successMessage,
            color: "success",
          });
          setTimeout(() => setCopiedField(null), 2000);
        })
        .catch(() => {
          fallbackCopy(text, field);
        });
    } else {
      fallbackCopy(text, field);
    }
  };

  const fallbackCopy = (text: string, field: "code" | "link") => {
    const successMessage = field === "code" ? "Access code copied" : "Join link copied";
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      setCopiedField(field);
      addToast({
        title: "Copied",
        description: successMessage,
        color: "success",
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      addToast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        color: "danger",
      });
    }

    document.body.removeChild(textArea);
  };

  const getScoreColor = (score: number | null): "success" | "warning" | "default" => {
    if (score === null) return "default";
    const threshold = code?.passingScore ?? 70;
    return score >= threshold ? "success" : "warning";
  };

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
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 px-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={pageTitle()}>{code.name}</h1>
          <p className="text-default-500 text-sm">Gradebook</p>
        </div>
        <Button
          color="primary"
          variant="flat"
          startContent={<Share2 className="w-4 h-4" />}
          onPress={() => setShareModalOpen(true)}
        >
          Invite Students
        </Button>
        <Button
          variant="bordered"
          startContent={<Pencil className="w-4 h-4" />}
          onPress={() => router.push(`/codes/${codeId}/edit`)}
        >
          Edit Cohort
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.total}</p>
              <p className="text-xs text-default-500">Total Students</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{gradebookData?.cases.length || 0}</p>
              <p className="text-xs text-default-500">Cases</p>
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
              <p className="text-xs text-default-500">Completed All</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between px-4">
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          startContent={<Search className="w-4 h-4 text-default-400" />}
          className="w-full sm:w-80"
          isClearable
          onClear={() => setSearchQuery("")}
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="w-4 h-4" />}
            onPress={openAssignCasesModal}
          >
            Assign Cases
          </Button>
          <Button
            variant="bordered"
            size="sm"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={() => { loadCode(); loadGradebook(); }}
          >
            Refresh
          </Button>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExportCSV}
            isDisabled={!filteredAndSortedStudents.length}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Gradebook Table - Full Width */}
      <div className="w-full">
        <Card className="rounded-none sm:rounded-lg sm:mx-4">
          <CardBody className="p-0">
            {loadingGradebook ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner size="lg" label="Loading gradebook..." />
              </div>
            ) : !gradebookData || filteredAndSortedStudents.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto text-default-300 mb-4" />
                {searchQuery ? (
                  <>
                    <p className="text-default-500">No students match your search</p>
                    <Button
                      variant="light"
                      size="sm"
                      className="mt-2"
                      onPress={() => setSearchQuery("")}
                    >
                      Clear search
                    </Button>
                  </>
                ) : (
                  <p className="text-default-500">No students in this cohort yet</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead className="bg-default-100 sticky top-0">
                    <tr>
                      <th
                        className="text-left p-3 font-medium cursor-pointer hover:bg-default-200 sticky left-0 bg-default-100 z-10 min-w-[160px]"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-2">
                          Student
                          <ArrowUpDown
                            size={14}
                            className={sortField === "name" ? "text-primary" : "text-default-400"}
                          />
                        </div>
                      </th>
                      <th
                        className="text-center p-3 font-medium cursor-pointer hover:bg-default-200 min-w-[90px]"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs">Enrollment</span>
                          <ArrowUpDown
                            size={12}
                            className={sortField === "status" ? "text-primary" : "text-default-400"}
                          />
                        </div>
                      </th>
                      {gradebookData.cases.map((caseInfo) => (
                        <th
                          key={caseInfo.id}
                          className="text-center p-3 font-medium cursor-pointer hover:bg-default-200 min-w-[150px]"
                          onClick={() => handleSort(caseInfo.id)}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs" title={caseInfo.name}>
                              {caseInfo.name}
                            </span>
                            <ArrowUpDown
                              size={12}
                              className={sortField === caseInfo.id ? "text-primary" : "text-default-400"}
                            />
                          </div>
                        </th>
                      ))}
                      <th
                        className="text-center p-3 font-medium cursor-pointer hover:bg-default-200 min-w-[80px] bg-default-50"
                        onClick={() => handleSort("average")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs">Avg</span>
                          <ArrowUpDown
                            size={12}
                            className={sortField === "average" ? "text-primary" : "text-default-400"}
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {filteredAndSortedStudents.map((student) => {
                      const statusConfig = STATUS_CONFIG[student.status];
                      return (
                      <tr
                        key={student.email}
                        className="hover:bg-default-50 cursor-pointer"
                        onClick={() => handleStudentClick(student.email)}
                      >
                        <td className="p-3 sticky left-0 bg-white dark:bg-default-50 z-10">
                          <span className="text-primary hover:underline font-medium text-sm">
                            {student.name}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Chip
                            size="sm"
                            color={statusConfig.color}
                            variant="flat"
                            startContent={statusConfig.icon}
                            className="text-xs"
                          >
                            {statusConfig.label}
                          </Chip>
                        </td>
                        {gradebookData.cases.map((caseInfo) => {
                          const caseData = student.cases.find((c) => c.caseId === caseInfo.id);
                          return (
                            <td
                              key={caseInfo.id}
                              className="p-3 text-center"
                              onClick={(e) => {
                                if (caseData?.bestScore !== null || (caseData?.attemptCount && caseData.attemptCount > 0)) {
                                  handleScoreClick(student.email, caseInfo.id, e);
                                }
                              }}
                            >
                              {caseData?.bestScore !== null && caseData?.bestScore !== undefined ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Chip
                                    size="sm"
                                    color={getScoreColor(caseData.bestScore)}
                                    variant="flat"
                                    className="cursor-pointer hover:opacity-80 text-xs"
                                  >
                                    {caseData.bestScore}
                                  </Chip>
                                  <span className="text-[10px] text-default-400">
                                    ({caseData.attemptCount})
                                  </span>
                                </div>
                              ) : caseData?.attemptCount && caseData.attemptCount > 0 ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Clock className="w-4 h-4 text-warning" />
                                  <span className="text-[10px] text-default-400">
                                    ({caseData.attemptCount})
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center" title="Not Started">
                                  <CircleDashed className="w-4 h-4 text-default-300" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center bg-default-50/50">
                          {student.averageScore !== null ? (
                            <Chip
                              size="sm"
                              color={getScoreColor(student.averageScore)}
                              variant="solid"
                              className="text-xs"
                            >
                              {student.averageScore}
                            </Chip>
                          ) : (
                            <span className="text-default-400 text-xs">—</span>
                          )}
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
      </div>

      {/* Legend */}
      {gradebookData && gradebookData.students.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-default-500 flex-wrap px-4">
          <div className="flex items-center gap-1.5">
            <Chip size="sm" color="success" variant="flat" className="text-xs">85</Chip>
            <span>Pass (≥{code.passingScore ?? 70})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Chip size="sm" color="warning" variant="flat" className="text-xs">55</Chip>
            <span>Below ({code.passingScore ?? 70})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-warning" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CircleDashed className="w-3.5 h-3.5 text-default-300" />
            <span>Not Started</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-default-400">(3)</span>
            <span>Attempts</span>
          </div>
        </div>
      )}

      {/* Cohort Details */}
      <div className="px-4">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Cohort Details</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-default-500">Passing Score</span>
              <Chip size="sm" variant="flat" color="primary">
                {code.passingScore ?? 70}
              </Chip>
            </div>
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

      {/* Share/Invite Modal */}
      <Modal 
        isOpen={shareModalOpen} 
        onClose={() => {
          setShareModalOpen(false);
          setCopiedField(null);
        }}
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Invite Students to {code.name}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-default-500 text-sm">
              Share the access code or join link with your students so they can enroll in this cohort.
            </p>
            
            {/* Access Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Access Code</label>
              <div className="flex gap-2">
                <Input
                  value={code.accessCode}
                  readOnly
                  classNames={{
                    input: "font-mono font-bold text-lg",
                  }}
                />
                <Button
                  color={copiedField === "code" ? "success" : "primary"}
                  variant="flat"
                  startContent={copiedField === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onPress={() => copyToClipboard(code.accessCode, "code")}
                >
                  {copiedField === "code" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Join Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Join Link</label>
              <div className="flex gap-2">
                <Input
                  value={getJoinLink(code.accessCode)}
                  readOnly
                  startContent={<Link className="w-4 h-4 text-default-400" />}
                  classNames={{
                    input: "text-sm",
                  }}
                />
                <Button
                  color={copiedField === "link" ? "success" : "primary"}
                  variant="flat"
                  startContent={copiedField === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onPress={() => copyToClipboard(getJoinLink(code.accessCode), "link")}
                >
                  {copiedField === "link" ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-default-400">
                Students can visit this link directly to join the cohort.
              </p>
            </div>

            {/* Access Mode Info */}
            <div className="p-3 bg-default-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Chip
                  size="sm"
                  variant="flat"
                  color={code.accessMode === "anyone" ? "success" : "warning"}
                >
                  {code.accessMode === "anyone" ? "Open Access" : "Restricted Access"}
                </Chip>
              </div>
              <p className="text-xs text-default-500 mt-2">
                {code.accessMode === "anyone"
                  ? "Anyone with the access code can join this cohort."
                  : "Only pre-approved email addresses can join this cohort."}
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => {
                setShareModalOpen(false);
                setCopiedField(null);
              }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Cases Modal */}
      <Modal
        isOpen={assignCasesModalOpen}
        onClose={() => setAssignCasesModalOpen(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Assign Cases to {code.name}
          </ModalHeader>
          <ModalBody>
            <p className="text-default-500 text-sm mb-4">
              Select which cases students in this cohort should complete. Assigned cases will appear in the gradebook.
            </p>

            {/* Search */}
            <Input
              placeholder="Search cases..."
              value={caseSearchQuery}
              onValueChange={setCaseSearchQuery}
              startContent={<Search className="w-4 h-4 text-default-400" />}
              className="mb-4"
              isClearable
              onClear={() => setCaseSearchQuery("")}
            />

            {/* Case List */}
            {loadingCases ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" label="Loading cases..." />
              </div>
            ) : availableCases.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto text-default-300 mb-4" />
                <p className="text-default-500">No cases available</p>
                <p className="text-default-400 text-sm mt-1">Create cases first to assign them to cohorts</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto border rounded-lg">
                {getFilteredCases().map((caseItem) => {
                  const isAssigned = assignedCaseIds.includes(caseItem.id);
                  return (
                    <div
                      key={caseItem.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-default-100 transition-colors ${
                        isAssigned ? "bg-primary/10" : ""
                      }`}
                      onClick={() => toggleCaseAssignment(caseItem.id)}
                    >
                      <Checkbox
                        isSelected={isAssigned}
                        onValueChange={() => toggleCaseAssignment(caseItem.id)}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{caseItem.name}</p>
                      </div>
                      {isAssigned && (
                        <Chip size="sm" color="primary" variant="flat">
                          Assigned
                        </Chip>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 text-sm text-default-500">
              {availableCases.length} total cases • {assignedCaseIds.length} assigned • {availableCases.length - assignedCaseIds.length} available
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setAssignCasesModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSaveCaseAssignments}
              isLoading={savingCases}
              startContent={!savingCases && <Check className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
