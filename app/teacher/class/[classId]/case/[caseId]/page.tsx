"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { title } from "@/components/primitives";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  TrendingUp,
  Clock,
  MessageSquare,
  Users,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import {
  getScoreByAttemptMode,
  calculateClassStats,
  exportGradebookToCSV,
  type ClassGradebookData,
  type ClassTrendData,
  type ClassProcessAnalytics,
  type AttemptViewMode,
  type StudentGradebookRow,
} from "@/lib/student-history-service";

interface PageProps {
  params: Promise<{
    classId: string;
    caseId: string;
  }>;
}

type SortField = "name" | "score";
type SortDirection = "asc" | "desc";
type FilterMode = "all" | "below_threshold" | "missing";

async function fetchGradebookData(classId: string, caseId: string) {
  const res = await fetch(`/api/student-history/gradebook/${classId}/${caseId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch gradebook");
  }
  return res.json();
}

function ClassTrendChart({ data }: { data: ClassTrendData[] }) {
  if (data.length === 0) {
    return (
      <div className="py-6 text-center text-default-400 text-sm">
        No trend data available
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-lg font-semibold text-primary">{data[0].averageScore}</span>
          <span className="text-sm text-default-400">
            Att. 1 (n={data[0].studentCount})
          </span>
        </div>
        <p className="text-xs text-default-400 text-center mt-2">Only one attempt available</p>
      </div>
    );
  }

  const scores = data.map((d) => d.averageScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const padding = Math.max(5, (maxScore - minScore) * 0.15);
  const yMin = Math.max(0, Math.floor(minScore - padding));
  const yMax = Math.min(100, Math.ceil(maxScore + padding));
  const yRange = yMax - yMin || 1;

  const svgHeight = 80;
  const topPadding = 18;
  const bottomPadding = 4;
  const sidePadding = 24;
  const plotHeight = svgHeight - topPadding - bottomPadding;

  return (
    <div className="w-full">
      <svg className="w-full" height={svgHeight} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--heroui-primary))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--heroui-primary))" stopOpacity="1" />
          </linearGradient>
        </defs>

        {(() => {
          const points = data.map((d, index) => {
            const xPercent = sidePadding + ((100 - 2 * sidePadding) * index) / (data.length - 1);
            const yPos = topPadding + plotHeight - ((d.averageScore - yMin) / yRange) * plotHeight;
            return { xPercent, yPos, data: d };
          });

          const pathD = points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.xPercent}% ${p.yPos}`)
            .join(" ");

          return (
            <g>
              <line
                x1={`${sidePadding}%`}
                y1={topPadding + plotHeight}
                x2={`${100 - sidePadding}%`}
                y2={topPadding + plotHeight}
                stroke="currentColor"
                strokeWidth="1"
                className="text-default-100"
              />
              <path
                d={pathD}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, index) => (
                <g key={index}>
                  <text
                    x={`${point.xPercent}%`}
                    y={point.yPos - 6}
                    textAnchor="middle"
                    className="fill-foreground text-xs font-semibold"
                    style={{ fontSize: "11px" }}
                  >
                    {point.data.averageScore}
                  </text>
                  <circle cx={`${point.xPercent}%`} cy={point.yPos} r="5" className="fill-background" />
                  <circle cx={`${point.xPercent}%`} cy={point.yPos} r="4" className="fill-primary" />
                </g>
              ))}
            </g>
          );
        })()}
      </svg>

      <div className="flex justify-between px-[24%] mt-1">
        {data.map((d) => (
          <div key={d.attemptNumber} className="text-center">
            <span className="text-xs text-default-400">
              Att. {d.attemptNumber} <span className="text-default-300">(n={d.studentCount})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendSummary({ data }: { data: ClassTrendData[] }) {
  if (data.length < 1) return null;

  const first = data[0];
  const last = data[data.length - 1];
  const change = last.averageScore - first.averageScore;
  const changeSign = change >= 0 ? "+" : "";
  const changeColor = change > 0 ? "text-success-600" : change < 0 ? "text-danger-600" : "text-default-500";

  if (data.length === 1) {
    return (
      <span className="text-xs text-default-500">
        Avg: <span className="font-medium text-default-700">{first.averageScore}</span>
        <span className="text-default-400 ml-1">({first.studentCount} students)</span>
      </span>
    );
  }

  return (
    <span className="text-xs text-default-500">
      Att. 1: <span className="font-medium text-default-700">{first.averageScore}</span>
      <span className="mx-2 text-default-300">→</span>
      Att. {last.attemptNumber}: <span className="font-medium text-default-700">{last.averageScore}</span>
      <span className="mx-2 text-default-300">|</span>
      <span className={`font-medium ${changeColor}`}>{changeSign}{change}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "default" | "success" | "warning" | "danger" | "primary";
}) {
  const colorClasses = {
    default: "bg-default-100 text-default-600",
    success: "bg-success-100 text-success-600",
    warning: "bg-warning-100 text-warning-600",
    danger: "bg-danger-100 text-danger-600",
    primary: "bg-primary-100 text-primary-600",
  };

  return (
    <Card className="flex-1 min-w-[120px]">
      <CardBody className="p-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>{icon}</div>
          <div>
            <p className="text-xs text-default-500">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function CaseClassOverviewPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { classId, caseId } = resolvedParams;

  const [gradebook, setGradebook] = useState<ClassGradebookData | null>(null);
  const [trendData, setTrendData] = useState<ClassTrendData[]>([]);
  const [processAnalytics, setProcessAnalytics] = useState<ClassProcessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attemptMode, setAttemptMode] = useState<AttemptViewMode>("best");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [threshold, setThreshold] = useState<number>(70);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGradebookData(classId, caseId);
        setGradebook(data.gradebook);
        setTrendData(data.trendData);
        setProcessAnalytics(data.processAnalytics);
      } catch (err) {
        setError("Failed to load gradebook data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [classId, caseId]);

  const currentStats = useMemo(() => {
    if (!gradebook) return null;
    return calculateClassStats(gradebook.students, attemptMode);
  }, [gradebook, attemptMode]);

  const filteredAndSortedStudents = useMemo(() => {
    if (!gradebook) return [];

    let filtered = [...gradebook.students];

    if (filterMode === "below_threshold") {
      filtered = filtered.filter((s) => {
        const score = getScoreByAttemptMode(s, attemptMode);
        return score !== null && score < threshold;
      });
    } else if (filterMode === "missing") {
      filtered = filtered.filter((s) => {
        const score = getScoreByAttemptMode(s, attemptMode);
        return score === null;
      });
    }

    filtered.sort((a, b) => {
      if (sortField === "name") {
        const cmp = a.studentName.localeCompare(b.studentName);
        return sortDirection === "asc" ? cmp : -cmp;
      } else {
        const scoreA = getScoreByAttemptMode(a, attemptMode) ?? -1;
        const scoreB = getScoreByAttemptMode(b, attemptMode) ?? -1;
        return sortDirection === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
    });

    return filtered;
  }, [gradebook, attemptMode, filterMode, threshold, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExportCSV = () => {
    if (!gradebook) return;
    const csv = exportGradebookToCSV(gradebook, attemptMode);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradebook-${classId}-${caseId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTable = async () => {
    if (!gradebook) return;
    const csv = exportGradebookToCSV(gradebook, attemptMode);
    await navigator.clipboard.writeText(csv);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleStudentClick = (studentId: string) => {
    router.push(`/teacher/class/${classId}/case/${caseId}/student/${studentId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading gradebook..." />
      </div>
    );
  }

  if (error || !gradebook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-danger text-lg">{error || "Data not found"}</p>
        <Button
          color="primary"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
          onPress={() => router.push(`/teacher/class/${classId}`)}
        >
          Back to Class
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="light"
            startContent={<ArrowLeft size={16} />}
            onPress={() => router.push(`/teacher/class/${classId}`)}
          >
            Back to Class
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className={title({ size: "sm" })}>Case Gradebook</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-default-400" />
                <span className="font-medium">{gradebook.section.code}</span>
              </div>
              <Divider orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-default-400" />
                <span className="font-medium">{gradebook.case.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="flat"
              size="sm"
              startContent={<Download size={14} />}
              onPress={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="flat"
              size="sm"
              startContent={copySuccess ? <Trophy size={14} /> : <Copy size={14} />}
              onPress={handleCopyTable}
              color={copySuccess ? "success" : "default"}
            >
              {copySuccess ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Gradebook Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                label="View Mode"
                size="sm"
                className="w-36"
                selectedKeys={[typeof attemptMode === "string" ? attemptMode : "specific"]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value === "best" || value === "first" || value === "latest") {
                    setAttemptMode(value);
                  }
                }}
              >
                <SelectItem key="best">Best Score</SelectItem>
                <SelectItem key="first">First Attempt</SelectItem>
                <SelectItem key="latest">Latest Attempt</SelectItem>
              </Select>

              <Select
                label="Filter"
                size="sm"
                className="w-40"
                selectedKeys={[filterMode]}
                onSelectionChange={(keys) => {
                  setFilterMode(Array.from(keys)[0] as FilterMode);
                }}
              >
                <SelectItem key="all">All Students</SelectItem>
                <SelectItem key="below_threshold">Below Threshold</SelectItem>
                <SelectItem key="missing">Missing Scores</SelectItem>
              </Select>

              {filterMode === "below_threshold" && (
                <Input
                  type="number"
                  label="Threshold"
                  size="sm"
                  className="w-24"
                  value={String(threshold)}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-default-500">
              <Users size={16} />
              <span>
                {filteredAndSortedStudents.length} of {gradebook.students.length} students
              </span>
            </div>
          </div>

          {currentStats && (
            <div className="flex flex-wrap gap-3 w-full">
              <StatCard
                label="Average"
                value={currentStats.average !== null ? currentStats.average : "N/A"}
                icon={<Trophy size={16} />}
                color="primary"
              />
              <StatCard
                label="Highest"
                value={currentStats.highest !== null ? currentStats.highest : "N/A"}
                icon={<TrendingUp size={16} />}
                color="success"
              />
              <StatCard
                label="Lowest"
                value={currentStats.lowest !== null ? currentStats.lowest : "N/A"}
                icon={<AlertTriangle size={16} />}
                color={currentStats.lowest !== null && currentStats.lowest < threshold ? "danger" : "warning"}
              />
              <StatCard
                label="Missing"
                value={`${currentStats.missingCount}/${currentStats.totalStudents}`}
                icon={<Users size={16} />}
                color={currentStats.missingCount > 0 ? "warning" : "default"}
              />
            </div>
          )}
        </CardHeader>

        <CardBody>
          {gradebook.students.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={48} className="mx-auto text-default-300 mb-4" />
              <p className="text-default-500 text-lg">No students enrolled in this class.</p>
            </div>
          ) : filteredAndSortedStudents.length === 0 ? (
            <div className="py-12 text-center">
              <Filter size={48} className="mx-auto text-default-300 mb-4" />
              <p className="text-default-500 text-lg">No students match the current filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-default-200">
                    <th
                      className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-default-100 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Student Name
                        <ArrowUpDown size={14} className={sortField === "name" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">Student ID</th>
                    <th
                      className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-default-100 transition-colors"
                      onClick={() => handleSort("score")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Score
                        <ArrowUpDown size={14} className={sortField === "score" ? "text-primary" : "text-default-400"} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedStudents.map((student) => {
                    const score = getScoreByAttemptMode(student, attemptMode);
                    const isBelowThreshold = score !== null && score < threshold;

                    return (
                      <tr
                        key={student.studentId}
                        className="border-b border-default-100 hover:bg-default-50 cursor-pointer transition-colors"
                        onClick={() => handleStudentClick(student.studentId)}
                      >
                        <td className="py-3 px-4">
                          <span className="text-primary hover:underline font-medium">{student.studentName}</span>
                        </td>
                        <td className="py-3 px-4 text-default-600">{student.studentNumber}</td>
                        <td className="py-3 px-4 text-right">
                          {score !== null ? (
                            <Chip size="sm" color={isBelowThreshold ? "danger" : "success"} variant="flat">
                              {score}
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="flat" color="default">
                              N/A
                            </Chip>
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

      {/* Class Trend Card */}
      <Card className="mb-6">
        <CardHeader className="pb-0 pt-3 px-4">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Class Trend
            </h2>
            <TrendSummary data={trendData} />
          </div>
        </CardHeader>
        <CardBody className="pt-2 pb-3 px-4">
          <ClassTrendChart data={trendData} />
        </CardBody>
      </Card>

      {/* Process Analytics Card */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-default-50 transition-colors"
          onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
        >
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock size={18} className="text-default-400" />
              Process & Learning Analytics
            </h2>
            <Button isIconOnly variant="light" size="sm" onPress={() => setAnalyticsExpanded(!analyticsExpanded)}>
              {analyticsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Button>
          </div>
        </CardHeader>

        {analyticsExpanded && processAnalytics && (
          <CardBody className="pt-0">
            <Divider className="mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-default-400" />
                  Time Spent
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-default-500">Average</span>
                    <span className="font-medium">{processAnalytics.avgTimeMinutes} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-500">Min / Max</span>
                    <span className="font-medium">
                      {processAnalytics.minTimeMinutes} / {processAnalytics.maxTimeMinutes} min
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-default-400" />
                  Messages / Questions
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-default-500">Average</span>
                    <span className="font-medium">{processAnalytics.avgMessageCount} messages</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-500">Min / Max</span>
                    <span className="font-medium">
                      {processAnalytics.minMessageCount} / {processAnalytics.maxMessageCount} messages
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
