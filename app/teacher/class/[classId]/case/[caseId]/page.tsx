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
  getClassGradebook,
  getClassTrendData,
  getClassProcessAnalytics,
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

function ClassTrendChart({ data }: { data: ClassTrendData[] }) {
  if (data.length === 0) {
    return (
      <div className="py-6 text-center text-default-400 text-sm">
        No trend data available
      </div>
    );
  }

  // Single attempt case - compact display
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

  // Calculate Y-axis range with padding, clamped to [0, 100]
  const scores = data.map((d) => d.averageScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const padding = Math.max(5, (maxScore - minScore) * 0.15);
  const yMin = Math.max(0, Math.floor(minScore - padding));
  const yMax = Math.min(100, Math.ceil(maxScore + padding));
  const yRange = yMax - yMin || 1;

  // SVG dimensions - full width, compact height
  const svgHeight = 80;
  const labelHeight = 20;
  const topPadding = 18;
  const bottomPadding = 4;
  const sidePadding = 24;
  const plotHeight = svgHeight - topPadding - bottomPadding;

  return (
    <div className="w-full">
      {/* SVG Sparkline */}
      <svg
        className="w-full"
        height={svgHeight}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--heroui-primary))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--heroui-primary))" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Render using percentage-based positioning */}
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
              {/* Subtle baseline */}
              <line
                x1={`${sidePadding}%`}
                y1={topPadding + plotHeight}
                x2={`${100 - sidePadding}%`}
                y2={topPadding + plotHeight}
                stroke="currentColor"
                strokeWidth="1"
                className="text-default-100"
              />

              {/* Line path */}
              <path
                d={pathD}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points and score labels */}
              {points.map((point, index) => (
                <g key={index}>
                  {/* Score label above */}
                  <text
                    x={`${point.xPercent}%`}
                    y={point.yPos - 6}
                    textAnchor="middle"
                    className="fill-foreground text-xs font-semibold"
                    style={{ fontSize: "11px" }}
                  >
                    {point.data.averageScore}
                  </text>
                  {/* Dot with white background */}
                  <circle
                    cx={`${point.xPercent}%`}
                    cy={point.yPos}
                    r="5"
                    className="fill-background"
                  />
                  <circle
                    cx={`${point.xPercent}%`}
                    cy={point.yPos}
                    r="4"
                    className="fill-primary"
                  />
                </g>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Attempt labels row - compact, below the chart */}
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
          <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
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

  // UI State
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
        const [gradebookData, trend, analytics] = await Promise.all([
          getClassGradebook(classId, caseId),
          getClassTrendData(classId, caseId),
          getClassProcessAnalytics(classId, caseId),
        ]);

        if (!gradebookData) {
          setError("Class or case not found");
          return;
        }

        setGradebook(gradebookData);
        setTrendData(trend);
        setProcessAnalytics(analytics);
      } catch (err) {
        setError("Failed to load gradebook data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [classId, caseId]);

  // Computed values
  const currentStats = useMemo(() => {
    if (!gradebook) return null;
    return calculateClassStats(gradebook.students, attemptMode);
  }, [gradebook, attemptMode]);

  const filteredAndSortedStudents = useMemo(() => {
    if (!gradebook) return [];

    let students = [...gradebook.students];

    // Apply filter
    if (filterMode === "below_threshold") {
      students = students.filter((s) => {
        const score = getScoreByAttemptMode(s, attemptMode);
        return score !== null && score < threshold;
      });
    } else if (filterMode === "missing") {
      students = students.filter(
        (s) => getScoreByAttemptMode(s, attemptMode) === null
      );
    }

    // Apply sort
    students.sort((a, b) => {
      if (sortField === "name") {
        const cmp = a.studentName.localeCompare(b.studentName);
        return sortDirection === "asc" ? cmp : -cmp;
      } else {
        const scoreA = getScoreByAttemptMode(a, attemptMode);
        const scoreB = getScoreByAttemptMode(b, attemptMode);
        if (scoreA === null && scoreB === null) return 0;
        if (scoreA === null) return sortDirection === "asc" ? 1 : -1;
        if (scoreB === null) return sortDirection === "asc" ? -1 : 1;
        return sortDirection === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
    });

    return students;
  }, [gradebook, filterMode, threshold, sortField, sortDirection, attemptMode]);

  const attemptOptions = useMemo(() => {
    if (!gradebook) return [];
    const options: Array<{ key: string; label: string; mode: AttemptViewMode }> = [
      { key: "best", label: "Best Score", mode: "best" },
      { key: "first", label: "First Attempt", mode: "first" },
      { key: "latest", label: "Latest Attempt", mode: "latest" },
    ];

    for (let i = 1; i <= gradebook.maxAttemptsInClass; i++) {
      options.push({
        key: `attempt_${i}`,
        label: `Attempt ${i}`,
        mode: { type: "specific", attemptNumber: i },
      });
    }

    return options;
  }, [gradebook]);

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
    a.download = `gradebook_${classId}_${caseId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCSV = async () => {
    if (!gradebook) return;
    const csv = exportGradebookToCSV(gradebook, attemptMode);
    try {
      await navigator.clipboard.writeText(csv);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
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
          Back to Class Dashboard
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

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className={title({ size: "sm" })}>Case Class Overview</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
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
        </div>
      </div>

      {/* PRIMARY BLOCK: Gradebook */}
      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-4 pb-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Trophy size={20} className="text-primary" />
              Gradebook
            </h2>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Attempt View Selector */}
              <Select
                label="Attempt View"
                selectedKeys={[
                  typeof attemptMode === "string"
                    ? attemptMode
                    : `attempt_${attemptMode.attemptNumber}`,
                ]}
                onSelectionChange={(keys) => {
                  const key = Array.from(keys)[0] as string;
                  const option = attemptOptions.find((o) => o.key === key);
                  if (option) setAttemptMode(option.mode);
                }}
                className="w-40"
                size="sm"
              >
                {attemptOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>

              {/* Filter */}
              <Select
                label="Filter"
                selectedKeys={[filterMode]}
                onSelectionChange={(keys) => {
                  setFilterMode(Array.from(keys)[0] as FilterMode);
                }}
                className="w-40"
                size="sm"
                startContent={<Filter size={14} />}
              >
                <SelectItem key="all">All Students</SelectItem>
                <SelectItem key="below_threshold">Below Threshold</SelectItem>
                <SelectItem key="missing">Missing Score</SelectItem>
              </Select>

              {filterMode === "below_threshold" && (
                <Input
                  type="number"
                  label="Threshold"
                  value={threshold.toString()}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                  className="w-24"
                  size="sm"
                />
              )}

              {/* Export buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Download size={14} />}
                  onPress={handleExportCSV}
                >
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color={copySuccess ? "success" : "default"}
                  startContent={<Copy size={14} />}
                  onPress={handleCopyCSV}
                >
                  {copySuccess ? "Copied!" : "Copy CSV"}
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          {currentStats && (
            <div className="flex flex-wrap gap-3 w-full pt-2">
              <StatCard
                label="Class Average"
                value={currentStats.average !== null ? currentStats.average : "N/A"}
                icon={<TrendingUp size={16} />}
                color="primary"
              />
              <StatCard
                label="Highest"
                value={currentStats.highest !== null ? currentStats.highest : "N/A"}
                icon={<Trophy size={16} />}
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
          {/* Gradebook Table */}
          {gradebook.students.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={48} className="mx-auto text-default-300 mb-4" />
              <p className="text-default-500 text-lg">
                No students enrolled in this class.
              </p>
            </div>
          ) : filteredAndSortedStudents.length === 0 ? (
            <div className="py-12 text-center">
              <Filter size={48} className="mx-auto text-default-300 mb-4" />
              <p className="text-default-500 text-lg">
                No students match the current filter.
              </p>
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
                        <ArrowUpDown
                          size={14}
                          className={
                            sortField === "name"
                              ? "text-primary"
                              : "text-default-400"
                          }
                        />
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Student ID
                    </th>
                    <th
                      className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-default-100 transition-colors"
                      onClick={() => handleSort("score")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Score
                        <ArrowUpDown
                          size={14}
                          className={
                            sortField === "score"
                              ? "text-primary"
                              : "text-default-400"
                          }
                        />
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
                          <span className="text-primary hover:underline font-medium">
                            {student.studentName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-default-600">
                          {student.studentNumber}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {score !== null ? (
                            <Chip
                              size="sm"
                              color={isBelowThreshold ? "danger" : "success"}
                              variant="flat"
                            >
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

      {/* SECONDARY BLOCK: Class Trend */}
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

      {/* TERTIARY BLOCK: Process & Learning Analytics (Collapsed by default) */}
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
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => setAnalyticsExpanded(!analyticsExpanded)}
            >
              {analyticsExpanded ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </Button>
          </div>
        </CardHeader>

        {analyticsExpanded && processAnalytics && (
          <CardBody className="pt-0">
            <Divider className="mb-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time Analytics */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-default-400" />
                  Time Spent
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-default-500">Average</span>
                    <span className="font-medium">
                      {processAnalytics.avgTimeMinutes} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-500">Min / Max</span>
                    <span className="font-medium">
                      {processAnalytics.minTimeMinutes} /{" "}
                      {processAnalytics.maxTimeMinutes} min
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Analytics */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-default-400" />
                  Messages / Questions
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-default-500">Average</span>
                    <span className="font-medium">
                      {processAnalytics.avgMessageCount} messages
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-500">Min / Max</span>
                    <span className="font-medium">
                      {processAnalytics.minMessageCount} /{" "}
                      {processAnalytics.maxMessageCount} messages
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Question Themes */}
            <div className="mt-6">
              <h3 className="font-medium mb-3">Top Question Themes</h3>
              <p className="text-xs text-default-400 mb-3">
                TODO: Implement NLP pipeline for question theme extraction
              </p>
              <div className="space-y-2">
                {processAnalytics.topQuestionThemes.map((theme, idx) => (
                  <div
                    key={theme.theme}
                    className="flex items-center gap-3"
                  >
                    <span className="text-default-400 w-6">{idx + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{theme.theme}</span>
                        <span className="text-sm text-default-500">
                          {theme.percentage}%
                        </span>
                      </div>
                      <div className="h-2 bg-default-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${theme.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
