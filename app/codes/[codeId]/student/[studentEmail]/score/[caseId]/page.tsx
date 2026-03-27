"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { Progress } from "@heroui/progress";
import {
  ArrowLeft,
  User,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  BarChart3,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { title } from "@/components/primitives";

interface AttemptScore {
  attemptNumber: number;
  score: number | null;
  date: string;
  status: "completed" | "in_progress";
  improvement: number | null;
}

interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  feedback?: string;
}

interface ScoreDetailData {
  studentEmail: string;
  studentName: string;
  caseId: string;
  caseName: string;
  cohortName: string;
  currentScore: number | null;
  bestScore: number | null;
  avgScore: number | null;
  passingScore: number;
  isPassing: boolean;
  totalAttempts: number;
  completedAttempts: number;
  improvementFromFirst: number | null;
  attempts: AttemptScore[];
  classAvgScore: number | null;
  classHighScore: number | null;
  percentile: number | null;
  latestEvalResult: string | null;
}

function ScoreGauge({ score, maxScore = 100, label }: { score: number | null; maxScore?: number; label: string }) {
  const percentage = score !== null ? (score / maxScore) * 100 : 0;
  const color = score === null ? "default" : score >= 70 ? "success" : score >= 50 ? "warning" : "danger";

  return (
    <div className="text-center">
      <div className="relative w-32 h-32 mx-auto">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-default-200"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${percentage * 3.52} 352`}
            className={`text-${color} transition-all duration-1000`}
            style={{ color: color === "success" ? "#17c964" : color === "warning" ? "#f5a524" : color === "danger" ? "#f31260" : "#71717a" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold">{score !== null ? score : "—"}</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-default-500">{label}</p>
    </div>
  );
}

function ScoreHistory({ attempts }: { attempts: AttemptScore[] }) {
  if (attempts.length === 0) return <p className="text-default-500 text-center py-4">No attempts yet</p>;

  const maxScore = 100;

  return (
    <div className="space-y-3">
      {attempts.map((attempt, idx) => (
        <div key={idx} className="flex items-center gap-4">
          <Chip size="sm" variant="flat" className="min-w-[80px] justify-center">
            Attempt {attempt.attemptNumber}
          </Chip>
          <div className="flex-1">
            <Progress
              value={attempt.score ?? 0}
              maxValue={maxScore}
              color={attempt.score === null ? "default" : attempt.score >= 70 ? "success" : attempt.score >= 50 ? "warning" : "danger"}
              className="h-3"
            />
          </div>
          <div className="w-16 text-right font-semibold">
            {attempt.score !== null ? `${attempt.score}%` : "—"}
          </div>
          {attempt.improvement !== null && (
            <div className={`w-16 text-right text-sm ${attempt.improvement > 0 ? "text-success" : attempt.improvement < 0 ? "text-danger" : "text-default-400"}`}>
              {attempt.improvement > 0 ? "+" : ""}{attempt.improvement}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ScoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const studentEmail = decodeURIComponent(params.studentEmail as string);
  const caseId = params.caseId as string;

  const [data, setData] = useState<ScoreDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [codeId, studentEmail, caseId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/codes/${codeId}/student/${encodeURIComponent(studentEmail)}/score/${caseId}`
      );
      
      if (!res.ok) {
        throw new Error("Failed to load score data");
      }
      
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Failed to load score data:", err);
      setError("Failed to load score data");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push(`/codes/${codeId}/student/${encodeURIComponent(studentEmail)}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading score details..." />
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={title({ size: "sm" })}>Score Details</h1>
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

      {/* Score Gauges */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-3 gap-8 py-4">
            <ScoreGauge score={data.currentScore} label="Current Score" />
            <ScoreGauge score={data.bestScore} label="Best Score" />
            <ScoreGauge score={data.avgScore !== null ? Math.round(data.avgScore) : null} label="Average Score" />
          </div>
        </CardBody>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className={`p-2 rounded-lg ${data.isPassing ? "bg-success/10" : "bg-warning/10"}`}>
              {data.isPassing ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-warning" />
              )}
            </div>
            <div>
              <p className="text-lg font-bold">{data.isPassing ? "Passing" : "Not Passing"}</p>
              <p className="text-xs text-default-500">Pass: {data.passingScore}+</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.completedAttempts}/{data.totalAttempts}</p>
              <p className="text-xs text-default-500">Completed Attempts</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className={`p-2 rounded-lg ${(data.improvementFromFirst ?? 0) >= 0 ? "bg-success/10" : "bg-danger/10"}`}>
              {(data.improvementFromFirst ?? 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : (
                <TrendingDown className="w-5 h-5 text-danger" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.improvementFromFirst !== null ? (
                  <span className={data.improvementFromFirst >= 0 ? "text-success" : "text-danger"}>
                    {data.improvementFromFirst > 0 ? "+" : ""}{data.improvementFromFirst}
                  </span>
                ) : "—"}
              </p>
              <p className="text-xs text-default-500">Improvement</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Award className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.percentile !== null ? `${data.percentile}%` : "—"}
              </p>
              <p className="text-xs text-default-500">Class Percentile</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Score History & Class Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Score History</p>
              <p className="text-sm text-default-500">Performance across attempts</p>
            </div>
          </CardHeader>
          <CardBody>
            <ScoreHistory attempts={data.attempts} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <Trophy size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Class Comparison</p>
              <p className="text-sm text-default-500">How you compare to classmates</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Your Best Score</span>
                <span className="font-semibold text-lg">{data.bestScore ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Class Average</span>
                <span className="font-semibold">{data.classAvgScore !== null ? Math.round(data.classAvgScore) : "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Class High Score</span>
                <span className="font-semibold">{data.classHighScore ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-default-500">Your Ranking</span>
                <Chip
                  color={data.percentile !== null && data.percentile >= 75 ? "success" : data.percentile !== null && data.percentile >= 50 ? "primary" : "warning"}
                  variant="flat"
                >
                  Top {data.percentile !== null ? 100 - data.percentile : "—"}%
                </Chip>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Latest Evaluation */}
      {data.latestEvalResult && (
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <Award size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Latest Evaluation Feedback</p>
              <p className="text-sm text-default-500">AI assessment of your most recent attempt</p>
            </div>
          </CardHeader>
          <CardBody>
            <pre className="whitespace-pre-wrap text-sm text-default-700 bg-default-50 p-4 rounded-lg">
              {data.latestEvalResult}
            </pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
