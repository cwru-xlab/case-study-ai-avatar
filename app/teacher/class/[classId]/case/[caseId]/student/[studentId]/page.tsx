"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { title } from "@/components/primitives";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import {
  ArrowLeft,
  User,
  BookOpen,
  Briefcase,
  Clock,
  MessageSquare,
  Trophy,
  TrendingUp,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  getStudentHistoryDetail,
  getStudentOverview,
  getTimeUsageDetails,
  getConversationDetails,
  getScoreDetails,
  getLearningCurveDetails,
  type StudentHistoryDetail,
  type StudentOverviewData,
} from "@/lib/student-history-service";

interface PageProps {
  params: Promise<{
    classId: string;
    caseId: string;
    studentId: string;
  }>;
}

type ViewMode = "case" | "overview";

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full h-16">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-primary"
      />
      {data.map((value, index) => {
        const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 80 - 10;
        return <circle key={index} cx={x} cy={y} r="4" className="fill-primary" />;
      })}
    </svg>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-default-500 text-sm">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface ModuleCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function ModuleCard({ title, icon, children }: ModuleCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex gap-3 pb-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="flex flex-col">
          <p className="text-md font-semibold">{title}</p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">{children}</CardBody>
    </Card>
  );
}

function CaseDetailView({ data }: { data: StudentHistoryDetail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Time Usage Module */}
      <ModuleCard title="Time Usage" icon={<Clock size={24} />}>
        <div className="space-y-1">
          <MetricRow
            label="Total Time"
            value={`${data.timeUsage.totalTimeMinutes} min`}
          />
          <MetricRow label="Sessions" value={data.timeUsage.numberOfSessions} />
          <MetricRow
            label="Avg Session"
            value={`${data.timeUsage.avgSessionLengthMinutes} min`}
          />
          <MetricRow
            label="Last Active"
            value={new Date(data.timeUsage.lastActiveDate).toLocaleDateString()}
          />
        </div>
      </ModuleCard>

      {/* Conversations Module */}
      <ModuleCard title="Conversations" icon={<MessageSquare size={24} />}>
        <div className="space-y-1">
          <MetricRow
            label="Total Messages"
            value={data.conversations.totalMessages}
          />
          <MetricRow label="Sessions" value={data.conversations.totalSessions} />
          <MetricRow
            label="Avg per Session"
            value={data.conversations.avgMessagesPerSession}
          />
          <MetricRow
            label="Last Conversation"
            value={new Date(
              data.conversations.lastConversationDate
            ).toLocaleDateString()}
          />
        </div>
      </ModuleCard>

      {/* Score Module */}
      <ModuleCard title="Score" icon={<Trophy size={24} />}>
        <div className="space-y-1">
          <MetricRow
            label="Current Score"
            value={
              data.score.currentScore !== null
                ? `${data.score.currentScore}/100`
                : "N/A"
            }
          />
          <MetricRow
            label="Best Score"
            value={
              data.score.bestScore !== null
                ? `${data.score.bestScore}/100`
                : "N/A"
            }
          />
          <MetricRow label="Attempts" value={data.score.numberOfAttempts} />
          <div className="flex justify-between items-center py-1">
            <span className="text-default-500 text-sm">Status</span>
            <Chip
              size="sm"
              color={data.score.isPassing ? "success" : "warning"}
              variant="flat"
            >
              {data.score.isPassing ? "Passing" : "Below Passing"}
            </Chip>
          </div>
        </div>
      </ModuleCard>

      {/* Learning Curve Module */}
      <ModuleCard title="Learning Curve" icon={<TrendingUp size={24} />}>
        <div className="space-y-2">
          <MiniSparkline
            data={data.learningCurve.attempts.map((a) => a.score)}
          />
          <div className="flex justify-between items-center">
            <span className="text-default-500 text-sm">Trend</span>
            <Chip
              size="sm"
              color={
                data.learningCurve.trend === "improving"
                  ? "success"
                  : data.learningCurve.trend === "stable"
                    ? "primary"
                    : "warning"
              }
              variant="flat"
            >
              {data.learningCurve.trend.charAt(0).toUpperCase() +
                data.learningCurve.trend.slice(1)}
            </Chip>
          </div>
          <div className="text-xs text-default-400">
            {data.learningCurve.attempts.map((a, i) => (
              <span key={a.attemptNumber}>
                {i > 0 && " → "}
                {a.score}
              </span>
            ))}
          </div>
        </div>
      </ModuleCard>

      {/* Attempts List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <h3 className="font-semibold">Attempt History</h3>
        </CardHeader>
        <CardBody className="pt-0">
          {data.attempts.length === 0 ? (
            <p className="text-default-500 text-center py-4">No attempts yet</p>
          ) : (
            <div className="space-y-2">
              {data.attempts.map((attempt) => (
                <div
                  key={attempt.attemptNumber}
                  className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Chip size="sm" variant="flat">
                      Attempt {attempt.attemptNumber}
                    </Chip>
                    <span className="text-sm text-default-500">
                      {new Date(attempt.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-default-500">
                      {attempt.totalMessages} messages
                    </span>
                    <span className="text-sm text-default-500">
                      {Math.round(attempt.totalTimeSeconds / 60)} min
                    </span>
                    <Chip
                      size="sm"
                      color={
                        attempt.score !== null && attempt.score >= 70
                          ? "success"
                          : "warning"
                      }
                      variant="flat"
                    >
                      {attempt.score !== null ? attempt.score : "In Progress"}
                    </Chip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function StudentOverviewView({ data }: { data: StudentOverviewData }) {
  const router = useRouter();

  return (
    <div>
      <p className="text-default-600 mb-4">
        Performance across all cases in {data.section.code}
      </p>

      {data.casesWithScores.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Briefcase size={48} className="mx-auto text-default-300 mb-4" />
            <p className="text-default-500">No cases assigned to this class.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.casesWithScores.map((item) => (
            <Card
              key={item.case.id}
              isPressable
              onPress={() =>
                router.push(
                  `/teacher/class/${data.section.id}/case/${item.case.id}/student/${data.student.id}`
                )
              }
              className="hover:scale-[1.01] transition-transform"
            >
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <p className="font-medium">{item.case.name}</p>
                      <p className="text-sm text-default-500">
                        {item.attemptCount} attempt
                        {item.attemptCount !== 1 ? "s" : ""}
                        {item.lastAttemptDate && (
                          <span>
                            {" "}
                            • Last:{" "}
                            {new Date(item.lastAttemptDate).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-default-500">Best Score</p>
                      <Chip
                        size="sm"
                        color={
                          item.bestScore !== null && item.bestScore >= 70
                            ? "success"
                            : item.bestScore !== null
                              ? "warning"
                              : "default"
                        }
                        variant="flat"
                      >
                        {item.bestScore !== null ? item.bestScore : "N/A"}
                      </Chip>
                    </div>
                    <ChevronRight size={20} className="text-default-400" />
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

export default function StudentDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { classId, caseId, studentId } = resolvedParams;

  const [viewMode, setViewMode] = useState<ViewMode>("case");
  const [caseData, setCaseData] = useState<StudentHistoryDetail | null>(null);
  const [overviewData, setOverviewData] = useState<StudentOverviewData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [caseDetail, overview] = await Promise.all([
          getStudentHistoryDetail(classId, studentId, caseId, "last_30_days"),
          getStudentOverview(classId, studentId),
        ]);

        if (!caseDetail && !overview) {
          setError("Student not found");
          return;
        }

        setCaseData(caseDetail);
        setOverviewData(overview);
      } catch (err) {
        setError("Failed to load student data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [classId, caseId, studentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading student details..." />
      </div>
    );
  }

  if (error || (!caseData && !overviewData)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-danger text-lg">{error || "Student not found"}</p>
        <Button
          color="primary"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
          onPress={() => router.push(`/teacher/class/${classId}/case/${caseId}`)}
        >
          Back to Gradebook
        </Button>
      </div>
    );
  }

  const student = caseData?.student || overviewData?.student;
  const section = caseData?.section || overviewData?.section;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="light"
            startContent={<ArrowLeft size={16} />}
            onPress={() => router.push(`/teacher/class/${classId}/case/${caseId}`)}
          >
            Back to Gradebook
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className={title({ size: "sm" })}>Student Detail</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-2">
                <User size={16} className="text-default-400" />
                <span className="font-medium">{student?.name}</span>
                <span className="text-default-400">
                  ({student?.studentNumber})
                </span>
              </div>
              <Divider orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-default-400" />
                <span className="text-default-600">{section?.code}</span>
              </div>
              {viewMode === "case" && caseData && (
                <>
                  <Divider orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-default-400" />
                    <span className="text-default-600">{caseData.case.name}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg bg-default-100 p-1">
          <button
            onClick={() => setViewMode("case")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "case"
                ? "bg-background text-foreground shadow-sm"
                : "text-default-600 hover:text-foreground"
            }`}
          >
            <Briefcase size={16} />
            <span>Current Case</span>
          </button>
          <button
            onClick={() => setViewMode("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "overview"
                ? "bg-background text-foreground shadow-sm"
                : "text-default-600 hover:text-foreground"
            }`}
          >
            <BookOpen size={16} />
            <span>All Cases Overview</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "case" && caseData ? (
        <CaseDetailView data={caseData} />
      ) : viewMode === "case" && !caseData ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Briefcase size={48} className="mx-auto text-default-300 mb-4" />
            <p className="text-default-500">
              No data available for this case.
            </p>
          </CardBody>
        </Card>
      ) : overviewData ? (
        <StudentOverviewView data={overviewData} />
      ) : (
        <Card>
          <CardBody className="py-12 text-center">
            <User size={48} className="mx-auto text-default-300 mb-4" />
            <p className="text-default-500">No overview data available.</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
