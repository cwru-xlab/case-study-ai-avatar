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
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Zap,
  Award,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { title } from "@/components/primitives";

interface AttemptData {
  attemptNumber: number;
  score: number | null;
  date: string;
  change: number | null;
  percentChange: number | null;
}

interface LearningInsight {
  type: "strength" | "improvement" | "pattern";
  title: string;
  description: string;
}

interface LearningCurveDetailData {
  studentEmail: string;
  studentName: string;
  caseId: string;
  caseName: string;
  cohortName: string;
  trend: "improving" | "stable" | "declining";
  trendStrength: "strong" | "moderate" | "weak";
  attempts: AttemptData[];
  firstScore: number | null;
  lastScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  totalImprovement: number | null;
  avgImprovement: number | null;
  consistencyScore: number | null;
  insights: LearningInsight[];
  projectedNextScore: number | null;
}

function LearningChart({ attempts }: { attempts: AttemptData[] }) {
  if (attempts.length === 0) return <p className="text-default-500 text-center py-8">No data available</p>;

  const scores = attempts.map((a) => a.score).filter((s): s is number => s !== null);
  if (scores.length === 0) return <p className="text-default-500 text-center py-8">No completed attempts</p>;

  const maxScore = 100;
  const minScore = 0;
  const range = maxScore - minScore;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = attempts
    .filter((a) => a.score !== null)
    .map((a, idx, arr) => {
      const x = padding.left + (idx / Math.max(arr.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - ((a.score! - minScore) / range) * chartHeight;
      return { x, y, score: a.score!, attempt: a.attemptNumber };
    });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--heroui-primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--heroui-primary))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 25, 50, 75, 100].map((val) => {
        const y = padding.top + chartHeight - (val / 100) * chartHeight;
        return (
          <g key={val}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="4"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              className="text-xs fill-default-400"
            >
              {val}
            </text>
          </g>
        );
      })}

      <line
        x1={padding.left}
        y1={padding.top + chartHeight - (70 / 100) * chartHeight}
        x2={width - padding.right}
        y2={padding.top + chartHeight - (70 / 100) * chartHeight}
        stroke="hsl(var(--heroui-success))"
        strokeOpacity="0.5"
        strokeDasharray="8"
        strokeWidth="2"
      />
      <text
        x={width - padding.right + 5}
        y={padding.top + chartHeight - (70 / 100) * chartHeight + 4}
        className="text-xs fill-success"
      >
        Pass
      </text>

      <path d={areaD} fill="url(#areaGradient)" />

      <path
        d={pathD}
        fill="none"
        stroke="hsl(var(--heroui-primary))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r="6"
            fill="hsl(var(--heroui-primary))"
            stroke="white"
            strokeWidth="2"
          />
          <text
            x={p.x}
            y={padding.top + chartHeight + 20}
            textAnchor="middle"
            className="text-xs fill-default-500"
          >
            #{p.attempt}
          </text>
          <text
            x={p.x}
            y={p.y - 12}
            textAnchor="middle"
            className="text-xs font-semibold fill-default-700"
          >
            {p.score}
          </text>
        </g>
      ))}
    </svg>
  );
}

function InsightCard({ insight }: { insight: LearningInsight }) {
  const iconMap = {
    strength: <Award className="w-5 h-5 text-success" />,
    improvement: <Target className="w-5 h-5 text-warning" />,
    pattern: <Zap className="w-5 h-5 text-primary" />,
  };

  const bgMap = {
    strength: "bg-success/10",
    improvement: "bg-warning/10",
    pattern: "bg-primary/10",
  };

  return (
    <div className={`p-4 rounded-lg ${bgMap[insight.type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{iconMap[insight.type]}</div>
        <div>
          <p className="font-medium">{insight.title}</p>
          <p className="text-sm text-default-500 mt-1">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function LearningCurveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const studentEmail = decodeURIComponent(params.studentEmail as string);
  const caseId = params.caseId as string;

  const [data, setData] = useState<LearningCurveDetailData | null>(null);
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
        `/api/codes/${codeId}/student/${encodeURIComponent(studentEmail)}/learning-curve/${caseId}`
      );
      
      if (!res.ok) {
        throw new Error("Failed to load learning curve data");
      }
      
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Failed to load learning curve data:", err);
      setError("Failed to load learning curve data");
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
        <Spinner size="lg" label="Loading learning curve details..." />
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

  const trendIcon = data.trend === "improving" ? (
    <TrendingUp className="w-6 h-6 text-success" />
  ) : data.trend === "declining" ? (
    <TrendingDown className="w-6 h-6 text-danger" />
  ) : (
    <Minus className="w-6 h-6 text-default-400" />
  );

  const trendColor = data.trend === "improving" ? "success" : data.trend === "declining" ? "danger" : "default";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={title({ size: "sm" })}>Learning Curve Analysis</h1>
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

      {/* Trend Summary */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-${trendColor}/10`}>
                {trendIcon}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {data.trend === "improving" ? "Improving Performance" : 
                   data.trend === "declining" ? "Declining Performance" : 
                   "Stable Performance"}
                </p>
                <p className="text-sm text-default-500">
                  {data.trendStrength.charAt(0).toUpperCase() + data.trendStrength.slice(1)} {data.trend} trend detected
                </p>
              </div>
            </div>
            <div className="text-right">
              {data.totalImprovement !== null && (
                <div className={`text-2xl font-bold ${data.totalImprovement >= 0 ? "text-success" : "text-danger"}`}>
                  {data.totalImprovement > 0 ? "+" : ""}{data.totalImprovement} pts
                </div>
              )}
              <p className="text-sm text-default-500">Total Change</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Learning Curve Chart */}
      <Card>
        <CardHeader className="flex gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BarChart3 size={20} />
          </div>
          <div>
            <p className="text-md font-semibold">Score Progression</p>
            <p className="text-sm text-default-500">Performance over time</p>
          </div>
        </CardHeader>
        <CardBody>
          <LearningChart attempts={data.attempts} />
        </CardBody>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-primary">{data.firstScore ?? "—"}</p>
            <p className="text-sm text-default-500">First Score</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-success">{data.lastScore ?? "—"}</p>
            <p className="text-sm text-default-500">Latest Score</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold">{data.bestScore ?? "—"}</p>
            <p className="text-sm text-default-500">Best Score</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-default-400">{data.worstScore ?? "—"}</p>
            <p className="text-sm text-default-500">Lowest Score</p>
          </CardBody>
        </Card>
      </div>

      {/* Detailed Stats & Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <Target size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Performance Metrics</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Average Improvement</span>
                <span className={`font-semibold ${(data.avgImprovement ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                  {data.avgImprovement !== null ? (
                    <>
                      {data.avgImprovement > 0 ? "+" : ""}{data.avgImprovement.toFixed(1)} pts/attempt
                    </>
                  ) : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Consistency Score</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{data.consistencyScore !== null ? `${data.consistencyScore}%` : "—"}</span>
                  {data.consistencyScore !== null && (
                    <Chip
                      size="sm"
                      color={data.consistencyScore >= 70 ? "success" : data.consistencyScore >= 40 ? "warning" : "danger"}
                      variant="flat"
                    >
                      {data.consistencyScore >= 70 ? "High" : data.consistencyScore >= 40 ? "Medium" : "Low"}
                    </Chip>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Total Attempts</span>
                <span className="font-semibold">{data.attempts.length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-default-500">Projected Next Score</span>
                <span className="font-semibold text-primary">
                  {data.projectedNextScore !== null ? `~${data.projectedNextScore}` : "—"}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Learning Insights */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Learning Insights</p>
              <p className="text-sm text-default-500">AI-generated observations</p>
            </div>
          </CardHeader>
          <CardBody>
            {data.insights.length > 0 ? (
              <div className="space-y-3">
                {data.insights.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} />
                ))}
              </div>
            ) : (
              <p className="text-default-500 text-center py-4">
                More attempts needed for insights
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Attempt Details */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Attempt Details</h3>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Attempt</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Date</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Score</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Change</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">% Change</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((attempt, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-default-50">
                    <td className="py-3 px-3">
                      <Chip size="sm" variant="flat">#{attempt.attemptNumber}</Chip>
                    </td>
                    <td className="py-3 px-3 text-sm">
                      {new Date(attempt.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-semibold ${
                        attempt.score === null ? "text-default-400" :
                        attempt.score >= 70 ? "text-success" : 
                        attempt.score >= 50 ? "text-warning" : "text-danger"
                      }`}>
                        {attempt.score ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {attempt.change !== null ? (
                        <div className={`flex items-center gap-1 ${attempt.change >= 0 ? "text-success" : "text-danger"}`}>
                          {attempt.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          <span>{attempt.change > 0 ? "+" : ""}{attempt.change}</span>
                        </div>
                      ) : (
                        <span className="text-default-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {attempt.percentChange !== null ? (
                        <span className={attempt.percentChange >= 0 ? "text-success" : "text-danger"}>
                          {attempt.percentChange > 0 ? "+" : ""}{attempt.percentChange.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-default-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
