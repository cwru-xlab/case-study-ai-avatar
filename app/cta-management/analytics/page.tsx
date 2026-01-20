"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { 
  ArrowLeft, 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  MessageSquare,
  TrendingUp,
  Clock,
  Mail,
  RefreshCw
} from "lucide-react";
import { title } from "@/components/primitives";
import type { CTASubmission } from "@/types";

interface AnalyticsData {
  totalSubmissions: number;
  submissionsByStatus: {
    pending: number;
    processed: number;
    failed: number;
  };
  submissionsByTimeframe: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  avatarStats: Array<{
    avatarName: string;
    submissionCount: number;
    averageMessageLength: number;
    averageChatDuration: number;
  }>;
  emailStats: {
    emailsSent: number;
    emailsFailed: number;
    successRate: number;
  };
  recentTrends: Array<{
    date: string;
    submissions: number;
  }>;
}

export default function CTAAnalyticsPage() {
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30"); // days

  // Load Analytics Data
  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all submissions for analysis
      const response = await fetch(`/api/cta/submissions?limit=1000`);
      
      if (!response.ok) {
        throw new Error("Failed to load analytics data");
      }

      const data = await response.json();
      
      if (data.success) {
        const processedAnalytics = processAnalyticsData(data.submissions);
        setAnalytics(processedAnalytics);
      } else {
        throw new Error("Failed to load analytics data");
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load analytics:", error);
      setError(error instanceof Error ? error.message : "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  // Process Raw Submissions into Analytics
  const processAnalyticsData = (submissions: CTASubmission[]): AnalyticsData => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const today = now - dayMs;
    const week = now - (7 * dayMs);
    const month = now - (30 * dayMs);
    const year = now - (365 * dayMs);

    // Basic counts
    const totalSubmissions = submissions.length;
    
    // Status breakdown
    const submissionsByStatus = {
      pending: submissions.filter(s => s.status === "pending").length,
      processed: submissions.filter(s => s.status === "processed").length,
      failed: submissions.filter(s => s.status === "failed").length,
    };

    // Time-based analysis
    const submissionsByTimeframe = {
      today: submissions.filter(s => new Date(s.createdAt).getTime() > today).length,
      week: submissions.filter(s => new Date(s.createdAt).getTime() > week).length,
      month: submissions.filter(s => new Date(s.createdAt).getTime() > month).length,
      year: submissions.filter(s => new Date(s.createdAt).getTime() > year).length,
    };

    // Avatar statistics
    const avatarMap = new Map();

    submissions.forEach(submission => {
      const avatarName = submission.metadata.avatarName;

      if (!avatarMap.has(avatarName)) {
        avatarMap.set(avatarName, {
          avatarName,
          submissionCount: 0,
          totalMessageLength: 0,
          totalChatDuration: 0,
        });
      }
      
      const avatar = avatarMap.get(avatarName);

      avatar.submissionCount++;
      avatar.totalMessageLength += submission.userDetails.message.length;
      avatar.totalChatDuration += submission.metadata.chatDuration;
    });

    const avatarStats = Array.from(avatarMap.values()).map(avatar => ({
      avatarName: avatar.avatarName,
      submissionCount: avatar.submissionCount,
      averageMessageLength: Math.round(avatar.totalMessageLength / avatar.submissionCount),
      averageChatDuration: Math.round(avatar.totalChatDuration / avatar.submissionCount),
    })).sort((a, b) => b.submissionCount - a.submissionCount);

    // Email statistics
    const emailsSent = submissions.filter(s => s.emailSent).length;
    const emailsFailed = submissions.filter(s => !s.emailSent && s.status === "processed").length;
    const successRate = totalSubmissions > 0 ? Math.round((emailsSent / totalSubmissions) * 100) : 0;

    const emailStats = {
      emailsSent,
      emailsFailed,
      successRate,
    };

    // Recent trends (last 7 days)
    const recentTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - (i * dayMs));
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = date.setHours(0, 0, 0, 0);
      const dayEnd = date.setHours(23, 59, 59, 999);
      
      const daySubmissions = submissions.filter(s => {
        const submissionTime = new Date(s.createdAt).getTime();
        return submissionTime >= dayStart && submissionTime <= dayEnd;
      }).length;

      recentTrends.push({
        date: dateStr,
        submissions: daySubmissions,
      });
    }

    return {
      totalSubmissions,
      submissionsByStatus,
      submissionsByTimeframe,
      avatarStats,
      emailStats,
      recentTrends,
    };
  };

  // Format Duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  // Export Analytics
  const exportAnalytics = async () => {
    try {
      const response = await fetch(`/api/cta/submissions?format=csv`);
      
      if (!response.ok) {
        throw new Error("Failed to export analytics");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cta-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Export error:", error);
      setError(error instanceof Error ? error.message : "Failed to export analytics");
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/cta-management")}
          >
            Back
          </Button>
          <h1 className={title()}>CTA Analytics</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/cta-management")}
          >
            Back
          </Button>
          <h1 className={title()}>CTA Analytics</h1>
        </div>
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/cta-management")}
          >
            Back
          </Button>
          <h1 className={title()}>CTA Analytics</h1>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadAnalytics}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            startContent={<Download className="w-4 h-4" />}
            onPress={exportAnalytics}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {analytics.totalSubmissions}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Total Submissions
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {analytics.submissionsByTimeframe.month}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <Calendar className="w-4 h-4" />
              This Month
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {analytics.emailStats.successRate}%
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <Mail className="w-4 h-4" />
              Email Success Rate
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {analytics.avatarStats.length}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <Users className="w-4 h-4" />
              Active Avatars
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Submission Status</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Processed</span>
                <div className="flex items-center gap-2">
                  <Chip color="success" variant="flat">
                    {analytics.submissionsByStatus.processed}
                  </Chip>
                  <span className="text-sm text-gray-500">
                    {analytics.totalSubmissions > 0 
                      ? Math.round((analytics.submissionsByStatus.processed / analytics.totalSubmissions) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Pending</span>
                <div className="flex items-center gap-2">
                  <Chip color="warning" variant="flat">
                    {analytics.submissionsByStatus.pending}
                  </Chip>
                  <span className="text-sm text-gray-500">
                    {analytics.totalSubmissions > 0 
                      ? Math.round((analytics.submissionsByStatus.pending / analytics.totalSubmissions) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Failed</span>
                <div className="flex items-center gap-2">
                  <Chip color="danger" variant="flat">
                    {analytics.submissionsByStatus.failed}
                  </Chip>
                  <span className="text-sm text-gray-500">
                    {analytics.totalSubmissions > 0 
                      ? Math.round((analytics.submissionsByStatus.failed / analytics.totalSubmissions) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Recent Trends */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold">Recent Trends (7 Days)</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {analytics.recentTrends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">
                    {new Date(trend.date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.max(5, (trend.submissions / Math.max(...analytics.recentTrends.map(t => t.submissions))) * 100)}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {trend.submissions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Avatar Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Avatar Performance</h2>
            </div>
          </CardHeader>
          <CardBody>
            {analytics.avatarStats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No avatar data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.avatarStats.map((avatar, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="font-medium">{avatar.avatarName}</p>
                        <p className="text-sm text-gray-600">
                          Rank #{index + 1}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-blue-600">
                          {avatar.submissionCount}
                        </p>
                        <p className="text-xs text-gray-600">Submissions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-green-600">
                          {avatar.averageMessageLength}
                        </p>
                        <p className="text-xs text-gray-600">Avg Message Length</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-purple-600">
                          {formatDuration(avatar.averageChatDuration)}
                        </p>
                        <p className="text-xs text-gray-600">Avg Chat Duration</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}