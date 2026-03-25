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
  Clock,
  Calendar,
  TrendingUp,
  BarChart3,
  Activity,
} from "lucide-react";
import { title } from "@/components/primitives";

interface SessionData {
  attemptNumber: number;
  date: string;
  durationMinutes: number;
  startTime: string;
  endTime: string | null;
  status: "completed" | "in_progress";
}

interface TimeUsageDetailData {
  studentEmail: string;
  studentName: string;
  caseId: string;
  caseName: string;
  cohortName: string;
  totalTimeMinutes: number;
  totalSessions: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
  shortestSessionMinutes: number;
  lastActiveDate: string;
  firstActiveDate: string;
  sessions: SessionData[];
  dailyActivity: Array<{ date: string; minutes: number }>;
  peakHours: Array<{ hour: number; sessions: number }>;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function TimelineChart({ sessions }: { sessions: SessionData[] }) {
  if (sessions.length === 0) return null;

  const maxDuration = Math.max(...sessions.map((s) => s.durationMinutes), 1);

  return (
    <div className="space-y-2">
      {sessions.map((session, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-20 text-xs text-default-500">
            {new Date(session.date).toLocaleDateString()}
          </div>
          <div className="flex-1 h-6 bg-default-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
              style={{ width: `${(session.durationMinutes / maxDuration) * 100}%` }}
            />
          </div>
          <div className="w-16 text-sm font-medium text-right">
            {formatTime(session.durationMinutes)}
          </div>
          <Chip
            size="sm"
            color={session.status === "completed" ? "success" : "warning"}
            variant="flat"
          >
            #{session.attemptNumber}
          </Chip>
        </div>
      ))}
    </div>
  );
}

function ActivityHeatmap({ dailyActivity }: { dailyActivity: Array<{ date: string; minutes: number }> }) {
  if (dailyActivity.length === 0) return <p className="text-default-500 text-center py-4">No activity data</p>;

  const maxMinutes = Math.max(...dailyActivity.map((d) => d.minutes), 1);

  return (
    <div className="flex flex-wrap gap-1">
      {dailyActivity.map((day, idx) => {
        const intensity = day.minutes / maxMinutes;
        const bgColor = intensity === 0 
          ? "bg-default-100" 
          : intensity < 0.33 
            ? "bg-primary/30" 
            : intensity < 0.66 
              ? "bg-primary/60" 
              : "bg-primary";
        
        return (
          <div
            key={idx}
            className={`w-4 h-4 rounded-sm ${bgColor} cursor-pointer transition-transform hover:scale-125`}
            title={`${new Date(day.date).toLocaleDateString()}: ${day.minutes} min`}
          />
        );
      })}
    </div>
  );
}

export default function TimeUsageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeId = params.codeId as string;
  const studentEmail = decodeURIComponent(params.studentEmail as string);
  const caseId = params.caseId as string;

  const [data, setData] = useState<TimeUsageDetailData | null>(null);
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
        `/api/codes/${codeId}/student/${encodeURIComponent(studentEmail)}/time-usage/${caseId}`
      );
      
      if (!res.ok) {
        throw new Error("Failed to load time usage data");
      }
      
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Failed to load time usage data:", err);
      setError("Failed to load time usage data");
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
        <Spinner size="lg" label="Loading time usage details..." />
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
          <h1 className={title({ size: "sm" })}>Time Usage Details</h1>
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
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatTime(data.totalTimeMinutes)}</p>
              <p className="text-xs text-default-500">Total Time</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Activity className="w-5 h-5 text-success" />
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
              <p className="text-2xl font-bold">{formatTime(data.avgSessionMinutes)}</p>
              <p className="text-xs text-default-500">Avg Session</p>
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
                {new Date(data.lastActiveDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-default-500">Last Active</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Session Timeline */}
      <Card>
        <CardHeader className="flex gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BarChart3 size={20} />
          </div>
          <div>
            <p className="text-md font-semibold">Session Timeline</p>
            <p className="text-sm text-default-500">
              Duration of each practice session
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <TimelineChart sessions={data.sessions} />
        </CardBody>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Statistics */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Session Statistics</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Longest Session</span>
                <span className="font-semibold">{formatTime(data.longestSessionMinutes)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">Shortest Session</span>
                <span className="font-semibold">{formatTime(data.shortestSessionMinutes)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-default-500">First Activity</span>
                <span className="font-semibold">{new Date(data.firstActiveDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-default-500">Active Days</span>
                <span className="font-semibold">{data.dailyActivity.filter(d => d.minutes > 0).length}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Activity Heatmap */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-md font-semibold">Activity Pattern</p>
              <p className="text-sm text-default-500">Daily practice intensity</p>
            </div>
          </CardHeader>
          <CardBody>
            <ActivityHeatmap dailyActivity={data.dailyActivity} />
            <div className="flex items-center gap-2 mt-4 text-xs text-default-400">
              <span>Less</span>
              <div className="w-3 h-3 rounded-sm bg-default-100" />
              <div className="w-3 h-3 rounded-sm bg-primary/30" />
              <div className="w-3 h-3 rounded-sm bg-primary/60" />
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>More</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Session Details Table */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">All Sessions</h3>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Attempt</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Date</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Start Time</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Duration</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-default-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-default-50">
                    <td className="py-3 px-3">
                      <Chip size="sm" variant="flat">#{session.attemptNumber}</Chip>
                    </td>
                    <td className="py-3 px-3 text-sm">
                      {new Date(session.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-sm text-default-500">
                      {new Date(session.startTime).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3 text-sm font-medium">
                      {formatTime(session.durationMinutes)}
                    </td>
                    <td className="py-3 px-3">
                      <Chip
                        size="sm"
                        color={session.status === "completed" ? "success" : "warning"}
                        variant="flat"
                      >
                        {session.status === "completed" ? "Completed" : "In Progress"}
                      </Chip>
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
