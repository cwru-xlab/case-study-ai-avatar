"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import { 
  Settings, 
  Mail, 
  BarChart3, 
  Users, 
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Plus,
  Eye,
  Calendar,
  TrendingUp
} from "lucide-react";
import { title } from "@/components/primitives";
import type { CTAConfig, CTASubmission } from "@/types";

interface CTAStats {
  totalSubmissions: number;
  todaySubmissions: number;
  weekSubmissions: number;
  monthSubmissions: number;
  averageResponseTime: number;
  topAvatars: Array<{
    avatarName: string;
    submissionCount: number;
  }>;
}

export default function CTAManagementPage() {
  const router = useRouter();
  
  const [config, setConfig] = useState<CTAConfig | null>(null);
  const [stats, setStats] = useState<CTAStats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<CTASubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Dashboard Data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load configuration and recent data in parallel
      const [configResponse, submissionsResponse] = await Promise.all([
        fetch("/api/cta/config"),
        fetch("/api/cta/submissions?limit=100")
      ]);

      if (!configResponse.ok) {
        throw new Error("Failed to load CTA configuration");
      }

      if (!submissionsResponse.ok) {
        throw new Error("Failed to load submissions data");
      }

      const configData = await configResponse.json();
      const submissionsData = await submissionsResponse.json();

      setConfig(configData.config);
      setRecentSubmissions(submissionsData.submissions || []);
      
      // Calculate stats from submissions data
      const calculatedStats = calculateStats(submissionsData.submissions || []);
      setStats(calculatedStats);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load dashboard data:", error);
      setError(error instanceof Error ? error.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate Statistics
  const calculateStats = (submissions: CTASubmission[]): CTAStats => {
    const now = Date.now();
    const today = new Date().setHours(0, 0, 0, 0);
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const todaySubmissions = submissions.filter(sub => 
      new Date(sub.createdAt).getTime() >= today
    ).length;

    const weekSubmissions = submissions.filter(sub => 
      new Date(sub.createdAt).getTime() >= weekAgo
    ).length;

    const monthSubmissions = submissions.filter(sub => 
      new Date(sub.createdAt).getTime() >= monthAgo
    ).length;

    // Calculate avatar popularity
    const avatarCounts: Record<string, number> = {};
    submissions.forEach(sub => {
      const name = sub.metadata.avatarName;
      avatarCounts[name] = (avatarCounts[name] || 0) + 1;
    });

    const topAvatars = Object.entries(avatarCounts)
      .map(([avatarName, submissionCount]) => ({ avatarName, submissionCount }))
      .sort((a, b) => b.submissionCount - a.submissionCount)
      .slice(0, 5);

    return {
      totalSubmissions: submissions.length,
      todaySubmissions,
      weekSubmissions,
      monthSubmissions,
      averageResponseTime: 0, // TODO: Calculate from email send times
      topAvatars
    };
  };

  // Toggle CTA System
  const handleToggleCTA = async (enabled: boolean) => {
    try {
      setConfigLoading(true);

      const response = await fetch("/api/cta/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update CTA configuration");
      }

      const data = await response.json();
      setConfig(data.config);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to toggle CTA:", error);
      setError(error instanceof Error ? error.message : "Failed to update configuration");
    } finally {
      setConfigLoading(false);
    }
  };

  // Navigation Helpers
  const navigateToConfig = () => router.push("/cta-management/config");
  const navigateToSubmissions = () => router.push("/cta-management/submissions");
  const navigateToAnalytics = () => router.push("/cta-management/analytics");

  // Loading State
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className={title()}>CTA Management</h1>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>CTA Management</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadDashboardData}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            startContent={<Settings className="w-4 h-4" />}
            onPress={navigateToConfig}
          >
            Configuration
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      )}

      {/* System Status */}
      {config && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">System Status</h2>
              </div>
              <Switch
                isSelected={config.enabled}
                onValueChange={handleToggleCTA}
                isDisabled={configLoading}
                color="success"
              >
                {config.enabled ? "Enabled" : "Disabled"}
              </Switch>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Chip 
                  color={config.enabled ? "success" : "danger"} 
                  variant="flat"
                  className="mt-1"
                >
                  {config.enabled ? "Active" : "Inactive"}
                </Chip>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email Recipients</p>
                <p className="font-medium">{config.emailRecipients.length} configured</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="font-medium">
                  {new Date(config.lastUpdated).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {stats.totalSubmissions}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <MessageSquare className="w-4 h-4" />
                Total Submissions
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats.todaySubmissions}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <Calendar className="w-4 h-4" />
                Today
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {stats.weekSubmissions}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <TrendingUp className="w-4 h-4" />
                This Week
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {stats.monthSubmissions}
              </div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <BarChart3 className="w-4 h-4" />
                This Month
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" isPressable onPress={navigateToSubmissions}>
          <CardBody className="text-center p-6">
            <Eye className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">View Submissions</h3>
            <p className="text-sm text-gray-600">
              Browse and manage form submissions from users
            </p>
          </CardBody>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" isPressable onPress={navigateToConfig}>
          <CardBody className="text-center p-6">
            <Settings className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Configuration</h3>
            <p className="text-sm text-gray-600">
              Manage email settings, templates, and system options
            </p>
          </CardBody>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" isPressable onPress={navigateToAnalytics}>
          <CardBody className="text-center p-6">
            <BarChart3 className="w-8 h-8 text-purple-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Analytics</h3>
            <p className="text-sm text-gray-600">
              View detailed analytics and usage reports
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold">Recent Submissions</h2>
            </div>
            <Button
              variant="light"
              size="sm"
              endContent={<ExternalLink className="w-4 h-4" />}
              onPress={navigateToSubmissions}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {recentSubmissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No submissions yet</p>
              <p className="text-sm">Submissions will appear here when users submit the CTA form</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSubmissions.slice(0, 5).map((submission) => (
                <div
                  key={submission.submissionId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{submission.userDetails.name}</p>
                      <Chip
                        size="sm"
                        color={
                          submission.status === "processed" ? "success" :
                          submission.status === "failed" ? "danger" : "warning"
                        }
                        variant="flat"
                      >
                        {submission.status}
                      </Chip>
                    </div>
                    <p className="text-sm text-gray-600">
                      {submission.userDetails.email} • {submission.metadata.avatarName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(submission.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => router.push(`/cta-management/submissions/${submission.submissionId}`)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Top Avatars */}
      {stats && stats.topAvatars.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">Popular Avatars</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {stats.topAvatars.map((avatar, index) => (
                <div key={avatar.avatarName} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
                      {index + 1}
                    </div>
                    <p className="font-medium">{avatar.avatarName}</p>
                  </div>
                  <Chip size="sm" variant="flat">
                    {avatar.submissionCount} submission{avatar.submissionCount !== 1 ? 's' : ''}
                  </Chip>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}