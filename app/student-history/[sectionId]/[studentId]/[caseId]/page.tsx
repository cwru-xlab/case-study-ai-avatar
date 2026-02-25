"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { title } from "@/components/primitives";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Divider } from "@heroui/divider";
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  Trophy,
  TrendingUp,
  Calendar,
  User,
  BookOpen,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import {
  getStudentHistoryDetail,
  getTimeUsageDetails,
  getConversationDetails,
  getScoreDetails,
  getLearningCurveDetails,
  type StudentHistoryDetail,
  type TimeRangeOption,
  TIME_RANGE_OPTIONS,
} from "@/lib/student-history-service";

interface PageProps {
  params: Promise<{
    sectionId: string;
    studentId: string;
    caseId: string;
  }>;
}

type ModuleType = "time" | "conversations" | "score" | "learning";

interface ModuleCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}

function ModuleCard({ title, icon, children, onClick }: ModuleCardProps) {
  return (
    <Card
      isPressable
      onPress={onClick}
      className="h-full hover:scale-[1.02] transition-transform cursor-pointer"
    >
      <CardHeader className="flex gap-3 pb-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="flex flex-col">
          <p className="text-md font-semibold">{title}</p>
        </div>
        <ChevronRight
          size={20}
          className="ml-auto text-default-400 group-hover:text-primary transition-colors"
        />
      </CardHeader>
      <CardBody className="pt-0">{children}</CardBody>
    </Card>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-default-500 text-sm">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
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
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 80 - 10;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="4"
            className="fill-primary"
          />
        );
      })}
    </svg>
  );
}

export default function StudentHistoryDetailPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);

  const { sectionId, studentId, caseId } = resolvedParams;
  const timeRange = (searchParams.get("range") as TimeRangeOption) || "last_30_days";

  const [data, setData] = useState<StudentHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAttempt, setSelectedAttempt] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<ModuleType | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await getStudentHistoryDetail(
          sectionId,
          studentId,
          caseId,
          timeRange
        );
        if (result) {
          setData(result);
          if (result.attempts.length > 0) {
            setSelectedAttempt(result.attempts[result.attempts.length - 1].attemptNumber);
          }
        } else {
          setError("Student history not found");
        }
      } catch (err) {
        setError("Failed to load student history");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [sectionId, studentId, caseId, timeRange]);

  const openModal = async (moduleType: ModuleType) => {
    setActiveModal(moduleType);
    setModalLoading(true);
    setModalData(null);

    try {
      let result;
      switch (moduleType) {
        case "time":
          result = await getTimeUsageDetails(
            sectionId,
            studentId,
            caseId,
            selectedAttempt || undefined
          );
          break;
        case "conversations":
          result = await getConversationDetails(
            sectionId,
            studentId,
            caseId,
            selectedAttempt || undefined
          );
          break;
        case "score":
          result = await getScoreDetails(sectionId, studentId, caseId);
          break;
        case "learning":
          result = await getLearningCurveDetails(sectionId, studentId, caseId);
          break;
      }
      setModalData(result);
    } catch (err) {
      console.error("Failed to load modal data:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading student history..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-danger text-lg">{error || "Data not found"}</p>
        <Button
          color="primary"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
          onPress={() => router.push("/student-history")}
        >
          Back to Search
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header / Context Bar */}
      <Card className="mb-6">
        <CardBody className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="light"
                startContent={<ArrowLeft size={16} />}
                onPress={() => router.push("/student-history")}
              >
                Back
              </Button>
              <Divider orientation="vertical" className="h-8 hidden lg:block" />
            </div>

            <div className="flex flex-wrap items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-2">
                <User size={16} className="text-default-400" />
                <div>
                  <p className="text-sm text-default-500">Student</p>
                  <p className="font-medium">
                    {data.student.name}{" "}
                    <span className="text-default-400 text-sm">
                      ({data.student.studentNumber})
                    </span>
                  </p>
                </div>
              </div>

              <Divider orientation="vertical" className="h-8 hidden sm:block" />

              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-default-400" />
                <div>
                  <p className="text-sm text-default-500">Course/Section</p>
                  <p className="font-medium">
                    {data.section.code}{" "}
                    <span className="text-default-400 text-sm">
                      ({data.section.id})
                    </span>
                  </p>
                </div>
              </div>

              <Divider orientation="vertical" className="h-8 hidden sm:block" />

              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-default-400" />
                <div>
                  <p className="text-sm text-default-500">Case</p>
                  <p className="font-medium">
                    {data.case.name}{" "}
                    <span className="text-default-400 text-sm">
                      ({data.case.id})
                    </span>
                  </p>
                </div>
              </div>

              <Divider orientation="vertical" className="h-8 hidden sm:block" />

              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-default-400" />
                <div>
                  <p className="text-sm text-default-500">Time Range</p>
                  <Chip size="sm" color="primary" variant="flat">
                    {data.timeRange}
                  </Chip>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Attempt Selector */}
      {data.attempts.length > 0 && (
        <div className="mb-6">
          <Select
            label="Select Attempt"
            placeholder="Choose an attempt to view"
            selectedKeys={selectedAttempt ? [String(selectedAttempt)] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              setSelectedAttempt(value ? Number(value) : null);
            }}
            className="max-w-xs"
          >
            {data.attempts.map((attempt) => (
              <SelectItem key={String(attempt.attemptNumber)}>
                Attempt {attempt.attemptNumber} -{" "}
                {attempt.score !== null ? `Score: ${attempt.score}` : "In Progress"} (
                {new Date(attempt.startedAt).toLocaleDateString()})
              </SelectItem>
            ))}
          </Select>
        </div>
      )}

      {/* 2x2 Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time Usage Module */}
        <ModuleCard
          title="Time Usage"
          icon={<Clock size={24} />}
          onClick={() => openModal("time")}
        >
          <div className="space-y-1">
            <MetricRow
              label="Total Time"
              value={`${data.timeUsage.totalTimeMinutes} min`}
            />
            <MetricRow
              label="Sessions"
              value={data.timeUsage.numberOfSessions}
            />
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
        <ModuleCard
          title="Conversations"
          icon={<MessageSquare size={24} />}
          onClick={() => openModal("conversations")}
        >
          <div className="space-y-1">
            <MetricRow
              label="Total Messages"
              value={data.conversations.totalMessages}
            />
            <MetricRow
              label="Sessions"
              value={data.conversations.totalSessions}
            />
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
        <ModuleCard
          title="Score"
          icon={<Trophy size={24} />}
          onClick={() => openModal("score")}
        >
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
        <ModuleCard
          title="Learning Curve"
          icon={<TrendingUp size={24} />}
          onClick={() => openModal("learning")}
        >
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
      </div>

      {/* Detail Modal */}
      <Modal isOpen={activeModal !== null} onClose={closeModal} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {activeModal === "time" && "Time Usage Details"}
                {activeModal === "conversations" && "Conversation Details"}
                {activeModal === "score" && "Score Details"}
                {activeModal === "learning" && "Learning Curve Details"}
              </ModalHeader>
              <ModalBody>
                {modalLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner label="Loading details..." />
                  </div>
                ) : modalData ? (
                  <div className="space-y-4">
                    {activeModal === "time" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardBody>
                              <p className="text-sm text-default-500">
                                Total Time
                              </p>
                              <p className="text-2xl font-bold">
                                {modalData.totalTimeMinutes} min
                              </p>
                            </CardBody>
                          </Card>
                          <Card>
                            <CardBody>
                              <p className="text-sm text-default-500">
                                Peak Activity Hour
                              </p>
                              <p className="text-2xl font-bold">
                                {modalData.peakActivityHour}:00
                              </p>
                            </CardBody>
                          </Card>
                        </div>
                        <Divider />
                        <div>
                          <p className="font-semibold mb-2">Session History</p>
                          <div className="space-y-2">
                            {modalData.sessions.map(
                              (session: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center p-3 bg-default-100 rounded-lg"
                                >
                                  <span>{session.date}</span>
                                  <span>{session.durationMinutes} min</span>
                                  <span>{session.messagesCount} messages</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {activeModal === "conversations" && (
                      <div className="space-y-3">
                        {modalData.conversations.map((conv: any) => (
                          <Card key={conv.sessionId}>
                            <CardBody>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{conv.date}</p>
                                  <p className="text-sm text-default-500">
                                    {conv.messageCount} messages •{" "}
                                    {conv.duration} min
                                  </p>
                                  <p className="text-sm mt-2 text-default-600">
                                    {conv.preview}
                                  </p>
                                </div>
                                <Chip size="sm" variant="flat">
                                  {conv.sessionId}
                                </Chip>
                              </div>
                            </CardBody>
                          </Card>
                        ))}
                      </div>
                    )}

                    {activeModal === "score" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardBody>
                              <p className="text-sm text-default-500">
                                Class Average
                              </p>
                              <p className="text-2xl font-bold">
                                {modalData.classAverage}
                              </p>
                            </CardBody>
                          </Card>
                          <Card>
                            <CardBody>
                              <p className="text-sm text-default-500">
                                Percentile
                              </p>
                              <p className="text-2xl font-bold">
                                {modalData.percentile}th
                              </p>
                            </CardBody>
                          </Card>
                        </div>
                        <Divider />
                        <div>
                          <p className="font-semibold mb-2">
                            Score Breakdown by Attempt
                          </p>
                          {modalData.attempts.map((attempt: any) => (
                            <Card key={attempt.attemptNumber} className="mb-3">
                              <CardBody>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">
                                    Attempt {attempt.attemptNumber}
                                  </span>
                                  <Chip color="primary">
                                    Score: {attempt.score}
                                  </Chip>
                                </div>
                                <div className="space-y-1">
                                  {attempt.breakdown.map((cat: any) => (
                                    <div
                                      key={cat.category}
                                      className="flex justify-between text-sm"
                                    >
                                      <span className="text-default-500">
                                        {cat.category}
                                      </span>
                                      <span>
                                        {cat.score}/{cat.maxScore}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}

                    {activeModal === "learning" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardBody>
                              <p className="text-sm text-default-500">
                                Improvement Rate
                              </p>
                              <p className="text-2xl font-bold">
                                +{modalData.improvementRate}%
                              </p>
                            </CardBody>
                          </Card>
                          <Card>
                            <CardBody>
                              <p className="text-sm text-default-500">
                                Predicted Next Score
                              </p>
                              <p className="text-2xl font-bold">
                                {modalData.predictedNextScore || "N/A"}
                              </p>
                            </CardBody>
                          </Card>
                        </div>
                        <Divider />
                        <div>
                          <p className="font-semibold mb-2">Progress Chart</p>
                          <div className="h-32">
                            <MiniSparkline
                              data={modalData.dataPoints.map(
                                (d: any) => d.score
                              )}
                            />
                          </div>
                          <div className="mt-4 space-y-2">
                            {modalData.dataPoints.map((point: any) => (
                              <div
                                key={point.attemptNumber}
                                className="flex justify-between items-center p-2 bg-default-100 rounded"
                              >
                                <span>Attempt {point.attemptNumber}</span>
                                <span>{point.date}</span>
                                <span>{point.timeSpentMinutes} min</span>
                                <Chip size="sm" color="primary">
                                  {point.score}
                                </Chip>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-default-500 py-8">
                    No data available
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="primary" variant="flat" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
