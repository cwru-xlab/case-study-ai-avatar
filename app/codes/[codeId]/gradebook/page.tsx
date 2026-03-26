"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  ArrowUpDown,
  BookOpen,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";

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
}

interface GradebookData {
  students: StudentGradebookEntry[];
  cases: Array<{ id: string; name: string }>;
  cohortName: string;
}

type SortField = "name" | "average" | string;
type SortDirection = "asc" | "desc";

export default function GradebookPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;

  const [gradebookData, setGradebookData] = useState<GradebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    loadGradebook();
  }, [codeId]);

  const loadGradebook = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/codes/${codeId}/gradebook`);
      if (res.ok) {
        const data = await res.json();
        setGradebookData(data);
      } else {
        addToast({ title: "Failed to load gradebook", color: "danger" });
      }
    } catch (err) {
      console.error("Failed to load gradebook:", err);
      addToast({ title: "Failed to load gradebook", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedStudents = useMemo(() => {
    if (!gradebookData) return [];

    let filtered = gradebookData.students;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.email.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query)
      );
    }

    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;

      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "average") {
        const avgA = a.averageScore ?? -1;
        const avgB = b.averageScore ?? -1;
        cmp = avgA - avgB;
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
  }, [gradebookData, searchQuery, sortField, sortDirection]);

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
      "Email",
      ...gradebookData.cases.map((c) => c.name),
      "Average",
    ];

    const rows = filteredAndSortedStudents.map((student) => {
      const caseScores = gradebookData.cases.map((caseInfo) => {
        const caseData = student.cases.find((c) => c.caseId === caseInfo.id);
        if (caseData?.bestScore !== null && caseData?.bestScore !== undefined) {
          return `${caseData.bestScore} (${caseData.attemptCount})`;
        }
        return caseData?.attemptCount ? `— (${caseData.attemptCount})` : "—";
      });

      return [
        student.name,
        student.email,
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

  const handleBack = () => router.push(`/codes/${codeId}`);

  const getScoreColor = (score: number | null): "success" | "warning" | "default" => {
    if (score === null) return "default";
    return score >= 70 ? "success" : "warning";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading gradebook..." />
      </div>
    );
  }

  if (!gradebookData) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Failed to load gradebook</p>
          <Button className="mt-4" onPress={handleBack}>
            Back to Cohort
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={pageTitle()}>Gradebook</h1>
          <p className="text-default-500 text-sm">{gradebookData.cohortName}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Input
          placeholder="Search by name or email..."
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
            onPress={loadGradebook}
          >
            Refresh
          </Button>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExportCSV}
            isDisabled={filteredAndSortedStudents.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Gradebook Table */}
      <Card>
        <CardBody className="p-0">
          {filteredAndSortedStudents.length === 0 ? (
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
                <p className="text-default-500">No students in this cohort</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-default-100 sticky top-0">
                  <tr>
                    <th
                      className="text-left p-4 font-medium cursor-pointer hover:bg-default-200 sticky left-0 bg-default-100 z-10 min-w-[200px]"
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
                    {gradebookData.cases.map((caseInfo) => (
                      <th
                        key={caseInfo.id}
                        className="text-center p-4 font-medium cursor-pointer hover:bg-default-200 min-w-[120px]"
                        onClick={() => handleSort(caseInfo.id)}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="truncate max-w-[100px]" title={caseInfo.name}>
                            {caseInfo.name}
                          </span>
                          <ArrowUpDown
                            size={14}
                            className={sortField === caseInfo.id ? "text-primary" : "text-default-400"}
                          />
                        </div>
                      </th>
                    ))}
                    <th
                      className="text-center p-4 font-medium cursor-pointer hover:bg-default-200 min-w-[100px] bg-default-50"
                      onClick={() => handleSort("average")}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Average
                        <ArrowUpDown
                          size={14}
                          className={sortField === "average" ? "text-primary" : "text-default-400"}
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {filteredAndSortedStudents.map((student) => (
                    <tr
                      key={student.email}
                      className="hover:bg-default-50 cursor-pointer"
                      onClick={() => handleStudentClick(student.email)}
                    >
                      <td className="p-4 sticky left-0 bg-white dark:bg-default-50 z-10">
                        <div>
                          <span className="text-primary hover:underline font-medium block">
                            {student.name}
                          </span>
                          <span className="text-xs text-default-400">{student.email}</span>
                        </div>
                      </td>
                      {gradebookData.cases.map((caseInfo) => {
                        const caseData = student.cases.find((c) => c.caseId === caseInfo.id);
                        return (
                          <td
                            key={caseInfo.id}
                            className="p-4 text-center"
                            onClick={(e) => {
                              if (caseData?.bestScore !== null) {
                                handleScoreClick(student.email, caseInfo.id, e);
                              }
                            }}
                          >
                            {caseData?.bestScore !== null && caseData?.bestScore !== undefined ? (
                              <div className="flex flex-col items-center gap-1">
                                <Chip
                                  size="sm"
                                  color={getScoreColor(caseData.bestScore)}
                                  variant="flat"
                                  className="cursor-pointer hover:opacity-80"
                                >
                                  {caseData.bestScore}
                                </Chip>
                                <span className="text-xs text-default-400">
                                  ({caseData.attemptCount})
                                </span>
                              </div>
                            ) : caseData?.attemptCount && caseData.attemptCount > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-default-400">—</span>
                                <span className="text-xs text-default-400">
                                  ({caseData.attemptCount})
                                </span>
                              </div>
                            ) : (
                              <span className="text-default-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-4 text-center bg-default-50/50">
                        {student.averageScore !== null ? (
                          <Chip
                            size="sm"
                            color={getScoreColor(student.averageScore)}
                            variant="solid"
                          >
                            {student.averageScore}
                          </Chip>
                        ) : (
                          <span className="text-default-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-default-500">
        <div className="flex items-center gap-2">
          <Chip size="sm" color="success" variant="flat">85</Chip>
          <span>Passing (≥70)</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" color="warning" variant="flat">55</Chip>
          <span>Below Passing (&lt;70)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-default-300">—</span>
          <span>Not Attempted</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-default-400">(3)</span>
          <span>Number of Attempts</span>
        </div>
      </div>
    </div>
  );
}
