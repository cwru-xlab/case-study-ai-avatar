"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import {
  ArrowLeft,
  User,
  MessageSquare,
  Clock,
  Calendar,
  Hash,
  TrendingUp,
  Lightbulb,
  BarChart3,
  FileText,
} from "lucide-react";
import { title } from "@/components/primitives";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface RoleInteraction {
  roleId: string;
  roleName: string;
  messages: Message[];
  startedAt?: number;
  endedAt?: number;
}

interface ConversationSession {
  attemptNumber: number;
  logId: string;
  startedAt: string;
  completedAt: string | null;
  totalMessages: number;
  totalTimeSeconds: number;
  score: number | null;
  status: "in_progress" | "completed";
  roleInteractions: Record<string, RoleInteraction>;
  evalResult?: string;
}

interface ConversationAnalysis {
  topWords: Array<{ word: string; count: number }>;
  openingApproaches: Array<{ approach: string; count: number; examples: string[] }>;
  avgMessageLength: number;
  studentMessageCount: number;
  assistantMessageCount: number;
  avgResponseTime: number;
  topicsDiscussed: string[];
}

interface ConversationDetailData {
  studentEmail: string;
  studentName: string;
  caseId: string;
  caseName: string;
  cohortName: string;
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  lastConversationDate: string;
  sessions: ConversationSession[];
  analysis: ConversationAnalysis;
}

function analyzeConversations(sessions: ConversationSession[]): ConversationAnalysis {
  const allStudentMessages: string[] = [];
  const openingMessages: string[] = [];
  let totalStudentMsgLength = 0;
  let studentMsgCount = 0;
  let assistantMsgCount = 0;

  sessions.forEach((session) => {
    Object.values(session.roleInteractions || {}).forEach((interaction) => {
      const messages = interaction.messages || [];
      messages.forEach((msg, idx) => {
        if (msg.role === "user") {
          allStudentMessages.push(msg.content);
          totalStudentMsgLength += msg.content.length;
          studentMsgCount++;
          if (idx === 0) {
            openingMessages.push(msg.content);
          }
        } else {
          assistantMsgCount++;
        }
      });
    });
  });

  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
    "because", "until", "while", "although", "though", "after", "before",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
    "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
    "she", "her", "hers", "herself", "it", "its", "itself", "they", "them",
    "their", "theirs", "themselves", "what", "which", "who", "whom", "this",
    "that", "these", "those", "am", "about", "also", "like", "think", "know",
    "want", "get", "make", "go", "see", "come", "take", "use", "find", "give",
    "tell", "ask", "work", "seem", "feel", "try", "leave", "call", "good",
    "new", "first", "last", "long", "great", "little", "own", "old", "right",
    "big", "high", "different", "small", "large", "next", "early", "young",
    "important", "public", "bad", "same", "able"
  ]);

  const wordCounts: Record<string, number> = {};
  allStudentMessages.forEach((msg) => {
    const words = msg.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
    words.forEach((word) => {
      if (word.length > 2 && !stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
  });

  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  const approachPatterns: Record<string, { count: number; examples: string[] }> = {
    "Direct Question": { count: 0, examples: [] },
    "Introduction/Greeting": { count: 0, examples: [] },
    "Context Setting": { count: 0, examples: [] },
    "Problem Statement": { count: 0, examples: [] },
    "Request for Information": { count: 0, examples: [] },
  };

  openingMessages.forEach((msg) => {
    const lowerMsg = msg.toLowerCase();
    let categorized = false;

    if (lowerMsg.includes("?") || lowerMsg.startsWith("what") || lowerMsg.startsWith("how") || 
        lowerMsg.startsWith("why") || lowerMsg.startsWith("can") || lowerMsg.startsWith("could")) {
      approachPatterns["Direct Question"].count++;
      if (approachPatterns["Direct Question"].examples.length < 3) {
        approachPatterns["Direct Question"].examples.push(msg.substring(0, 100));
      }
      categorized = true;
    }
    
    if (!categorized && (lowerMsg.includes("hello") || lowerMsg.includes("hi ") || 
        lowerMsg.startsWith("hi") || lowerMsg.includes("good morning") || 
        lowerMsg.includes("good afternoon"))) {
      approachPatterns["Introduction/Greeting"].count++;
      if (approachPatterns["Introduction/Greeting"].examples.length < 3) {
        approachPatterns["Introduction/Greeting"].examples.push(msg.substring(0, 100));
      }
      categorized = true;
    }

    if (!categorized && (lowerMsg.includes("i am") || lowerMsg.includes("i'm") || 
        lowerMsg.includes("we are") || lowerMsg.includes("our company") ||
        lowerMsg.includes("my name"))) {
      approachPatterns["Context Setting"].count++;
      if (approachPatterns["Context Setting"].examples.length < 3) {
        approachPatterns["Context Setting"].examples.push(msg.substring(0, 100));
      }
      categorized = true;
    }

    if (!categorized && (lowerMsg.includes("problem") || lowerMsg.includes("issue") || 
        lowerMsg.includes("challenge") || lowerMsg.includes("concern") ||
        lowerMsg.includes("need help"))) {
      approachPatterns["Problem Statement"].count++;
      if (approachPatterns["Problem Statement"].examples.length < 3) {
        approachPatterns["Problem Statement"].examples.push(msg.substring(0, 100));
      }
      categorized = true;
    }

    if (!categorized && (lowerMsg.includes("tell me") || lowerMsg.includes("explain") || 
        lowerMsg.includes("describe") || lowerMsg.includes("information") ||
        lowerMsg.includes("details"))) {
      approachPatterns["Request for Information"].count++;
      if (approachPatterns["Request for Information"].examples.length < 3) {
        approachPatterns["Request for Information"].examples.push(msg.substring(0, 100));
      }
      categorized = true;
    }

    if (!categorized && openingMessages.length > 0) {
      approachPatterns["Context Setting"].count++;
      if (approachPatterns["Context Setting"].examples.length < 3) {
        approachPatterns["Context Setting"].examples.push(msg.substring(0, 100));
      }
    }
  });

  const openingApproaches = Object.entries(approachPatterns)
    .filter(([, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([approach, data]) => ({
      approach,
      count: data.count,
      examples: data.examples,
    }));

  const topicsFromWords = topWords.slice(0, 8).map((w) => w.word);

  return {
    topWords,
    openingApproaches,
    avgMessageLength: studentMsgCount > 0 ? Math.round(totalStudentMsgLength / studentMsgCount) : 0,
    studentMessageCount: studentMsgCount,
    assistantMessageCount: assistantMsgCount,
    avgResponseTime: 0,
    topicsDiscussed: topicsFromWords,
  };
}

function WordCloud({ words }: { words: Array<{ word: string; count: number }> }) {
  const maxCount = Math.max(...words.map((w) => w.count));
  
  return (
    <div className="flex flex-wrap gap-2 justify-center py-4">
      {words.map((item, idx) => {
        const size = 0.8 + (item.count / maxCount) * 1.2;
        const opacity = 0.5 + (item.count / maxCount) * 0.5;
        return (
          <span
            key={idx}
            className="px-2 py-1 rounded-lg bg-primary/10 text-primary transition-transform hover:scale-110"
            style={{
              fontSize: `${size}rem`,
              opacity,
            }}
          >
            {item.word}
            <span className="text-xs ml-1 opacity-60">({item.count})</span>
          </span>
        );
      })}
    </div>
  );
}

function ConversationTranscript({ session }: { session: ConversationSession }) {
  return (
    <div className="space-y-4">
      {Object.entries(session.roleInteractions || {}).map(([roleId, interaction]) => (
        <div key={roleId} className="border rounded-lg overflow-hidden">
          <div className="p-3 bg-default-100 font-medium flex items-center justify-between">
            <span>{interaction.roleName}</span>
            <Chip size="sm" variant="flat">
              {interaction.messages?.length || 0} messages
            </Chip>
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {interaction.messages?.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-default-100"
                  }`}
                >
                  <div className="text-xs opacity-70 mb-1">
                    {msg.role === "user" ? "Student" : interaction.roleName} -{" "}
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const studentEmail = decodeURIComponent(params.studentEmail as string);
  const caseId = params.caseId as string;

  const [data, setData] = useState<ConversationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<number>(0);
  const [selectedTab, setSelectedTab] = useState<"analysis" | "transcripts">("analysis");

  useEffect(() => {
    loadData();
  }, [codeId, studentEmail, caseId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/codes/${codeId}/student/${encodeURIComponent(studentEmail)}/conversations/${caseId}`
      );
      
      if (!res.ok) {
        throw new Error("Failed to load conversation data");
      }
      
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Failed to load conversation data:", err);
      setError("Failed to load conversation data");
    } finally {
      setLoading(false);
    }
  };

  const analysis = useMemo(() => {
    if (!data?.sessions) return null;
    return analyzeConversations(data.sessions);
  }, [data?.sessions]);

  const handleBack = () => {
    router.push(`/codes/${codeId}/student/${encodeURIComponent(studentEmail)}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading conversation details..." />
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
          onPress={handleBack}
        >
          Back to Student Detail
        </Button>
      </div>
    );
  }

  const currentSession = data.sessions[selectedSession];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={title({ size: "sm" })}>Conversation Details</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <User size={16} className="text-default-400" />
              <span className="font-medium">{data.studentName}</span>
            </div>
            <Divider orientation="vertical" className="h-4" />
            <span className="text-default-500">{data.caseName}</span>
            <Divider orientation="vertical" className="h-4" />
            <span className="text-default-400">{data.cohortName}</span>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.totalMessages}</p>
              <p className="text-xs text-default-500">Total Messages</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Hash className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.totalSessions}</p>
              <p className="text-xs text-default-500">Sessions</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.avgMessagesPerSession}</p>
              <p className="text-xs text-default-500">Avg per Session</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Calendar className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {new Date(data.lastConversationDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-default-500">Last Conversation</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardBody className="p-2">
          <div className="flex gap-2">
            <Button
              variant={selectedTab === "analysis" ? "solid" : "light"}
              color={selectedTab === "analysis" ? "primary" : "default"}
              onPress={() => setSelectedTab("analysis")}
              startContent={<BarChart3 size={16} />}
            >
              Analysis & Summary
            </Button>
            <Button
              variant={selectedTab === "transcripts" ? "solid" : "light"}
              color={selectedTab === "transcripts" ? "primary" : "default"}
              onPress={() => setSelectedTab("transcripts")}
              startContent={<FileText size={16} />}
            >
              Conversation Transcripts
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Analysis Tab Content */}
      {selectedTab === "analysis" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Word Cloud */}
          <Card className="md:col-span-2">
            <CardHeader className="flex gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Hash size={20} />
              </div>
              <div>
                <p className="text-md font-semibold">Most Used Words</p>
                <p className="text-sm text-default-500">
                  Keywords frequently used by the student
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {analysis && analysis.topWords.length > 0 ? (
                <WordCloud words={analysis.topWords} />
              ) : (
                <p className="text-center text-default-500 py-4">
                  No word data available
                </p>
              )}
            </CardBody>
          </Card>

          {/* Opening Approaches */}
          <Card>
            <CardHeader className="flex gap-3">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <Lightbulb size={20} />
              </div>
              <div>
                <p className="text-md font-semibold">Opening Approaches</p>
                <p className="text-sm text-default-500">
                  How the student starts conversations
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {analysis && analysis.openingApproaches.length > 0 ? (
                <div className="space-y-3">
                  {analysis.openingApproaches.map((approach, idx) => (
                    <div key={idx} className="p-3 bg-default-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{approach.approach}</span>
                        <Chip size="sm" variant="flat" color="success">
                          {approach.count} times
                        </Chip>
                      </div>
                      {approach.examples.length > 0 && (
                        <div className="text-sm text-default-500 space-y-1">
                          {approach.examples.map((ex, i) => (
                            <p key={i} className="italic truncate">
                              &quot;{ex}...&quot;
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-default-500 py-4">
                  No approach data available
                </p>
              )}
            </CardBody>
          </Card>

          {/* Message Statistics */}
          <Card>
            <CardHeader className="flex gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="text-md font-semibold">Message Statistics</p>
                <p className="text-sm text-default-500">
                  Conversation metrics
                </p>
              </div>
            </CardHeader>
            <CardBody>
              {analysis ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-default-500">Student Messages</span>
                    <span className="font-semibold">{analysis.studentMessageCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-default-500">AI Responses</span>
                    <span className="font-semibold">{analysis.assistantMessageCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-default-500">Avg Message Length</span>
                    <span className="font-semibold">{analysis.avgMessageLength} chars</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-default-500">Topics Discussed</span>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                      {analysis.topicsDiscussed.slice(0, 5).map((topic, i) => (
                        <Chip key={i} size="sm" variant="flat">
                          {topic}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-default-500 py-4">
                  No statistics available
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Transcripts Tab Content */}
      {selectedTab === "transcripts" && (
        <div className="space-y-4">
          {/* Session Selector */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Select Session</h3>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {data.sessions.map((session, idx) => (
                  <Button
                    key={session.logId}
                    size="sm"
                    variant={selectedSession === idx ? "solid" : "bordered"}
                    color={selectedSession === idx ? "primary" : "default"}
                    onPress={() => setSelectedSession(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span>Attempt {session.attemptNumber}</span>
                      <Chip
                        size="sm"
                        color={session.status === "completed" ? "success" : "warning"}
                        variant="flat"
                      >
                        {session.status === "completed" ? session.score || "Done" : "In Progress"}
                      </Chip>
                    </div>
                  </Button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Session Info */}
          {currentSession && (
            <>
              <Card>
                <CardBody>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-default-400" />
                      <span className="text-sm">
                        {new Date(currentSession.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-default-400" />
                      <span className="text-sm">{currentSession.totalMessages} messages</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-default-400" />
                      <span className="text-sm">
                        {Math.round(currentSession.totalTimeSeconds / 60)} minutes
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Evaluation Result */}
              {currentSession.evalResult && (
                <Card>
                  <CardHeader className="flex gap-3">
                    <div className="p-2 rounded-lg bg-success/10 text-success">
                      <Lightbulb size={20} />
                    </div>
                    <div>
                      <p className="text-md font-semibold">AI Evaluation Summary</p>
                    </div>
                    {currentSession.score !== null && (
                      <Chip
                        color={currentSession.score >= 70 ? "success" : "warning"}
                        variant="flat"
                      >
                        Score: {currentSession.score}/100
                      </Chip>
                    )}
                  </CardHeader>
                  <CardBody>
                    <pre className="whitespace-pre-wrap text-sm text-default-700 bg-default-50 p-4 rounded-lg">
                      {currentSession.evalResult}
                    </pre>
                  </CardBody>
                </Card>
              )}

              {/* Transcript */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Full Conversation Transcript</h3>
                </CardHeader>
                <CardBody>
                  <ConversationTranscript session={currentSession} />
                </CardBody>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
