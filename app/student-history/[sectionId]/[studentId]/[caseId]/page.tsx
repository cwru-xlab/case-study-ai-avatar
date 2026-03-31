"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  type StudentHistoryDetail,
  type TimeRangeOption,
  TIME_RANGE_OPTIONS,
} from "@/lib/student-history-service";
import type { InteractionLog, InteractionEvent } from "@/types";

// ─── Timeline helpers ─────────────────────────────────────────────────────────

type TimelineMessage = {
  kind: "message";
  role: "user" | "assistant";
  content: string;
  roleName?: string;
  timestamp: number;
};

type TimelineEvent = {
  kind: "event";
  type: string;
  label: string;
  timestamp: number;
};

type TimelineItem = TimelineMessage | TimelineEvent;

function formatEventLabel(event: InteractionEvent): string {
  switch (event.type) {
    case "start_session":
      return "Session started";
    case "end_session":
      return "Session ended";
    case "enter_role":
      return `Joined: ${event.roleName || event.roleId || "avatar"}`;
    case "exit_role":
      return `Left: ${event.roleName || event.roleId || "avatar"}`;
    case "switch_interaction_mode":
      return `Switched to ${event.interactionMode || "unknown"} mode`;
    default:
      return event.type.replace(/_/g, " ");
  }
}

function buildTimeline(log: InteractionLog): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (log.events && log.events.length > 0) {
    for (const event of log.events) {
      if (
        event.type === "send_message" ||
        event.type === "receive_message"
      ) {
        if (event.messageContent) {
          items.push({
            kind: "message",
            role:
              event.messageRole ||
              (event.type === "send_message" ? "user" : "assistant"),
            content: event.messageContent,
            roleName: event.roleName,
            timestamp: event.timestamp,
          });
        }
      } else {
        items.push({
          kind: "event",
          type: event.type,
          label: formatEventLabel(event),
          timestamp: event.timestamp,
        });
      }
    }
  } else {
    // Fallback: build from roleInteractions
    for (const interaction of Object.values(log.roleInteractions)) {
      items.push({
        kind: "event",
        type: "enter_role",
        label: `Joined: ${interaction.roleName}`,
        timestamp: interaction.enteredAt,
      });
      for (const msg of interaction.messages) {
        items.push({
          kind: "message",
          role: msg.role,
          content: msg.content,
          roleName: interaction.roleName,
          timestamp: msg.timestamp,
        });
      }
      if (interaction.exitedAt) {
        items.push({
          kind: "event",
          type: "exit_role",
          label: `Left: ${interaction.roleName}`,
          timestamp: interaction.exitedAt,
        });
      }
    }
    items.sort((a, b) => a.timestamp - b.timestamp);
  }

  return items;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Chat bubble components ───────────────────────────────────────────────────

function getRoleColor(roleName?: string): string {
  if (!roleName) return "hsl(0 0% 94%)";
  let hash = 0;
  for (let i = 0; i < roleName.length; i++) {
    hash = (hash * 31 + roleName.charCodeAt(i)) & 0xffff;
  }
  const hue = hash % 360;
  return `hsl(${hue} 40% 92%)`;
}

function EventMarker({ label, timestamp }: { label: string; timestamp: number }) {
  return (
    <div className="flex items-center gap-3 my-3 px-2">
      <div className="flex-1 h-px bg-default-200" />
      <span className="text-xs text-default-400 whitespace-nowrap">
        {label} · {formatTime(timestamp)}
      </span>
      <div className="flex-1 h-px bg-default-200" />
    </div>
  );
}

function ChatBubble({ item }: { item: TimelineMessage }) {
  const isUser = item.role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} mb-2`}>
      {!isUser && item.roleName && (
        <span className="text-xs text-default-400 mb-1 ml-1">{item.roleName}</span>
      )}
      <div
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser ? "bg-primary text-white rounded-tr-sm" : "rounded-tl-sm"
        }`}
        style={!isUser ? { background: getRoleColor(item.roleName) } : undefined}
      >
        {item.content}
      </div>
      <span className="text-xs text-default-300 mt-1 mx-1">{formatTime(item.timestamp)}</span>
    </div>
  );
}

function InteractionLogView({ log }: { log: InteractionLog }) {
  const timeline = buildTimeline(log);

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-default-400">
        No messages recorded for this attempt
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto max-h-[65vh] px-2 py-1">
      {timeline.map((item, idx) =>
        item.kind === "event" ? (
          <EventMarker key={idx} label={item.label} timestamp={item.timestamp} />
        ) : (
          <ChatBubble key={idx} item={item} />
        )
      )}
    </div>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchStudentHistoryDetail(
  sectionId: string,
  studentId: string,
  caseId: string,
  timeRange: TimeRangeOption
): Promise<StudentHistoryDetail | null> {
  const res = await fetch(
    `/api/student-history/detail/${sectionId}/${studentId}/${caseId}?range=${timeRange}`
  );
  if (!res.ok) return null;
  return res.json();
}

async function fetchModuleDetails(
  sectionId: string,
  studentId: string,
  caseId: string,
  module: string,
  attemptNumber?: number
) {
  const params = new URLSearchParams({ module });
  if (attemptNumber) params.set("attemptNumber", String(attemptNumber));
  const res = await fetch(
    `/api/student-history/detail/${sectionId}/${studentId}/${caseId}?${params}`
  );
  if (!res.ok) throw new Error("Failed to fetch module details");
  return res.json();
}

async function fetchInteractionLog(
  sectionId: string,
  studentId: string,
  caseId: string,
  attemptNumber?: number
): Promise<InteractionLog | null> {
  const params = new URLSearchParams();
  if (attemptNumber) params.set("attemptNumber", String(attemptNumber));
  const res = await fetch(
    `/api/student-history/interaction-log/${sectionId}/${studentId}/${caseId}?${params}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.log || null;
}

// ─── Page components ──────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [interactionLog, setInteractionLog] = useState<InteractionLog | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchStudentHistoryDetail(
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
    setInteractionLog(null);

    try {
      if (moduleType === "conversations") {
        const log = await fetchInteractionLog(
          sectionId,
          studentId,
          caseId,
          selectedAttempt || undefined
        );
        setInteractionLog(log);
      } else {
        const result = await fetchModuleDetails(
          sectionId,
          studentId,
          caseId,
          moduleType,
          selectedAttempt || undefined
        );
        setModalData(result);
      }
    } catch (err) {
      console.error("Failed to load modal data:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
    setInteractionLog(null);
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
          title="Interaction Log"
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
      <Modal
        isOpen={activeModal !== null}
        onClose={closeModal}
        size={activeModal === "conversations" ? "3xl" : "2xl"}
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {activeModal === "time" && "Time Usage Details"}
                {activeModal === "conversations" &&
                  `Interaction Log${selectedAttempt ? ` — Attempt ${selectedAttempt}` : ""}`}
                {activeModal === "score" && "Score Details"}
                {activeModal === "learning" && "Learning Curve Details"}
              </ModalHeader>
              <ModalBody>
                {modalLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner label="Loading..." />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeModal === "time" && modalData && (
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
                      interactionLog ? (
                        <InteractionLogView log={interactionLog} />
                      ) : (
                        <div className="flex items-center justify-center py-12 text-default-400">
                          No interaction log found for this attempt
                        </div>
                      )
                    )}

                    {activeModal === "score" && modalData && (
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

                    {activeModal === "learning" && modalData && (
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
