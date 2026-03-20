"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { cohortStorage } from "@/lib/cohort-storage";
import { title } from "@/components/primitives";
import type { CachedCohort } from "@/types/cohort";

interface AttemptData {
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  totalMessages: number;
  totalTimeSeconds: number;
  logId?: string;
}

interface CaseDetailData {
  caseId: string;
  caseName: string;
  bestScore: number | null;
  latestScore: number | null;
  attemptCount: number;
  lastAttemptDate: string | null;
  totalTimeMinutes: number;
  totalMessages: number;
  attempts: AttemptData[];
  timeUsage: {
    totalTimeMinutes: number;
    numberOfSessions: number;
    avgSessionLengthMinutes: number;
    lastActiveDate: string;
  };
  conversations: {
    totalMessages: number;
    totalSessions: number;
    lastConversationDate: string;
    avgMessagesPerSession: number;
  };
  score: {
    currentScore: number | null;
    bestScore: number | null;
    numberOfAttempts: number;
    passingScore: number;
    isPassing: boolean;
  };
  learningCurve: {
    attempts: Array<{ attemptNumber: number; score: number; date: string }>;
    trend: "improving" | "stable" | "declining";
  };
}

interface StudentDetailData {
  email: string;
  name: string;
  cases: CaseDetailData[];
  overallStats: {
    totalCases: number;
    completedCases: number;
    avgScore: number | null;
    bestScore: number | null;
    totalTimeMinutes: number;
    totalAttempts: number;
  };
}

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

function CaseDetailView({ data, studentEmail }: { data: CaseDetailData; studentEmail: string }) {
  const [selectedAttemptLog, setSelectedAttemptLog] = useState<any>(null);
  const [loadingLog, setLoadingLog] = useState(false);

  const handleViewAttempt = async (attempt: AttemptData) => {
    if (!attempt.logId) return;
    setLoadingLog(true);
    try {
      const res = await fetch(
        `/api/interaction/get?studentEmail=${encodeURIComponent(studentEmail)}&caseId=${encodeURIComponent(data.caseId)}&logId=${encodeURIComponent(attempt.logId)}`
      );
      if (res.ok) {
        const result = await res.json();
        setSelectedAttemptLog(result.log);
      }
    } catch (err) {
      console.error("Failed to load interaction log:", err);
    } finally {
      setLoadingLog(false);
    }
  };

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
            value={new Date(data.conversations.lastConversationDate).toLocaleDateString()}
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
          <MiniSparkline data={data.learningCurve.attempts.map((a) => a.score)} />
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
                  className={`p-3 bg-default-50 rounded-lg cursor-pointer hover:bg-default-100 transition-colors ${
                    selectedAttemptLog?.attemptNumber === attempt.attemptNumber ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => attempt.logId && handleViewAttempt(attempt)}
                >
                  <div className="flex items-center justify-between">
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
                      {attempt.logId && (
                        <ChevronRight className="w-4 h-4 text-default-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Interaction Log Detail */}
      {loadingLog && (
        <Card className="md:col-span-2">
          <CardBody className="py-8 text-center">
            <p className="text-default-500">Loading interaction log...</p>
          </CardBody>
        </Card>
      )}

      {selectedAttemptLog && !loadingLog && (
        <>
          {/* Eval Result */}
          {selectedAttemptLog.evalResult && (
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy size={20} className="text-primary" />
                  <h3 className="font-semibold">Evaluation Result</h3>
                  {selectedAttemptLog.evalScore !== undefined && selectedAttemptLog.evalScore !== null && (
                    <Chip
                      size="sm"
                      color={selectedAttemptLog.evalScore >= 70 ? "success" : "warning"}
                      variant="flat"
                    >
                      Score: {selectedAttemptLog.evalScore}/100
                    </Chip>
                  )}
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <pre className="whitespace-pre-wrap text-sm text-default-700 bg-default-50 p-4 rounded-lg">
                  {selectedAttemptLog.evalResult}
                </pre>
              </CardBody>
            </Card>
          )}

          {/* Interaction Timeline */}
          <Card className="md:col-span-2">
            <CardHeader>
              <h3 className="font-semibold">Interaction Timeline</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedAttemptLog.events?.map((event: any, idx: number) => {
                  const time = new Date(event.timestamp).toLocaleTimeString();
                  let label = "";
                  let color = "default";

                  switch (event.type) {
                    case "start_session":
                      label = "Session started";
                      color = "success";
                      break;
                    case "enter_role":
                      label = `Entered conversation with ${event.roleName}`;
                      color = "primary";
                      break;
                    case "exit_role":
                      label = `Left conversation with ${event.roleName}`;
                      color = "warning";
                      break;
                    case "send_message":
                      label = `Student → ${event.roleName}: ${(event.messageContent || "").substring(0, 80)}${(event.messageContent || "").length > 80 ? "..." : ""}`;
                      break;
                    case "receive_message":
                      label = `${event.roleName} → Student: ${(event.messageContent || "").substring(0, 80)}${(event.messageContent || "").length > 80 ? "..." : ""}`;
                      break;
                    case "end_session":
                      label = "Session ended";
                      color = "danger";
                      break;
                  }

                  return (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      <span className="text-default-400 font-mono text-xs whitespace-nowrap pt-0.5">{time}</span>
                      <span className={`flex-1 ${event.type === "send_message" || event.type === "receive_message" ? "text-default-600" : "font-medium"}`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Full Conversation by Role */}
          <Card className="md:col-span-2">
            <CardHeader>
              <h3 className="font-semibold">Conversations by Role</h3>
            </CardHeader>
            <CardBody className="pt-0 space-y-4">
              {Object.entries(selectedAttemptLog.roleInteractions || {}).map(([roleId, interaction]: [string, any]) => (
                <div key={roleId} className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-default-100 font-medium text-sm">
                    {interaction.roleName} ({interaction.messages?.length || 0} messages)
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {interaction.messages?.map((msg: any, idx: number) => (
                      <div key={idx} className={`text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
                        <span className={`inline-block p-2 rounded-lg max-w-[80%] ${
                          msg.role === "user" ? "bg-primary/10" : "bg-default-50"
                        }`}>
                          <span className="text-xs text-default-400 block mb-1">
                            {msg.role === "user" ? "Student" : interaction.roleName} - {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          {msg.content}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const studentEmail = decodeURIComponent(params.studentEmail as string);

  const [code, setCode] = useState<CachedCohort | null>(null);
  const [studentData, setStudentData] = useState<StudentDetailData | null>(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [codeId, studentEmail]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const codeData = await cohortStorage.get(codeId);
      if (!codeData) {
        setError("Cohort not found");
        return;
      }
      setCode(codeData);

      const student = codeData.students?.find(
        (s) => s.email.toLowerCase() === studentEmail.toLowerCase()
      );
      if (!student) {
        setError("Student not found in this cohort");
        return;
      }

      const res = await fetch(
        `/api/codes/${codeId}/student/${encodeURIComponent(studentEmail)}/detail`
      );
      if (res.ok) {
        const data = await res.json();
        setStudentData(data);
      } else {
        setStudentData({
          email: student.email,
          name: student.name || student.email.split("@")[0],
          cases: [],
          overallStats: {
            totalCases: codeData.assignedCaseIds?.length || 0,
            completedCases: 0,
            avgScore: null,
            bestScore: null,
            totalTimeMinutes: 0,
            totalAttempts: 0,
          },
        });
      }
    } catch (err) {
      console.error("Failed to load student data:", err);
      setError("Failed to load student data");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => router.push(`/codes/${codeId}`);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading student details..." />
      </div>
    );
  }

  if (error || !studentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-danger text-lg">{error || "Student not found"}</p>
        <Button
          color="primary"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
          onPress={handleBack}
        >
          Back to Cohort
        </Button>
      </div>
    );
  }

  const { overallStats } = studentData;
  const selectedCase = studentData.cases[selectedCaseIndex];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={title({ size: "sm" })}>Student Detail</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <User size={16} className="text-default-400" />
              <span className="font-medium">{studentData.name}</span>
            </div>
            <Divider orientation="vertical" className="h-4" />
            <span className="text-default-500">{studentData.email}</span>
            {code && (
              <>
                <Divider orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-default-400" />
                  <span className="text-default-600">{code.name}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {overallStats.completedCases}/{overallStats.totalCases}
              </p>
              <p className="text-xs text-default-500">Cases Completed</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Trophy className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {overallStats.bestScore !== null ? overallStats.bestScore : "—"}
              </p>
              <p className="text-xs text-default-500">Best Score</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {overallStats.avgScore !== null ? Math.round(overallStats.avgScore) : "—"}
              </p>
              <p className="text-xs text-default-500">Avg Score</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Clock className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overallStats.totalTimeMinutes}</p>
              <p className="text-xs text-default-500">Total Minutes</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Case Selector */}
      {studentData.cases.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Select Case to View Details</h2>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {studentData.cases.map((caseItem, index) => (
                <Button
                  key={caseItem.caseId}
                  size="sm"
                  variant={selectedCaseIndex === index ? "solid" : "bordered"}
                  color={selectedCaseIndex === index ? "primary" : "default"}
                  onPress={() => setSelectedCaseIndex(index)}
                >
                  {caseItem.caseName}
                  {caseItem.bestScore !== null && (
                    <Chip
                      size="sm"
                      color={caseItem.bestScore >= 70 ? "success" : "warning"}
                      variant="flat"
                      className="ml-2"
                    >
                      {caseItem.bestScore}
                    </Chip>
                  )}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Case Detail View with 4 Modules */}
      {selectedCase ? (
        <>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Briefcase size={20} className="text-primary" />
            <span>{selectedCase.caseName}</span>
          </div>
          <CaseDetailView data={selectedCase} studentEmail={studentData.email} />
        </>
      ) : (
        <Card>
          <CardBody className="py-12 text-center">
            <Briefcase size={48} className="mx-auto text-default-300 mb-4" />
            <p className="text-default-500">No case data available</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
