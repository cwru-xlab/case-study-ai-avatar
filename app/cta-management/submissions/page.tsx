"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox } from "@heroui/checkbox";
import { Spinner } from "@heroui/spinner";

import { 
  Download, 
  Filter, 
  Search, 
  Trash2, 
  Eye, 
  RefreshCw,
  Calendar,
  User,
  Bot,
  Clock,
  CheckSquare,
  Square,
  ArrowLeft
} from "lucide-react";
import { title } from "@/components/primitives";
import type { CTASubmission } from "@/types";

interface SubmissionsResponse {
  success: boolean;
  submissions: CTASubmission[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function CTASubmissionsPage() {
  const router = useRouter();

  // Data state
  const [submissions, setSubmissions] = useState<CTASubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  });

  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    avatarId: "",
    startDate: "",
    endDate: ""
  });
  const [showFilters, setShowFilters] = useState(false);

  // Selection state for bulk operations
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load Submissions
  useEffect(() => {
    loadSubmissions();
  }, [filters, pagination.offset, pagination.limit]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });

      if (filters.status) params.set("status", filters.status);
      if (filters.avatarId) params.set("avatarId", filters.avatarId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const response = await fetch(`/api/cta/submissions?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to load submissions");
      }

      const data: SubmissionsResponse = await response.json();
      
      if (data.success) {
        setSubmissions(data.submissions);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore
        }));
      } else {
        throw new Error("Failed to load submissions");
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load submissions:", error);
      setError(error instanceof Error ? error.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  // Handle Filter Changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page
  };

  // Handle Selection
  const handleSelectSubmission = (submissionId: string, selected: boolean) => {
    if (selected) {
      setSelectedSubmissions(prev => [...prev, submissionId]);
    } else {
      setSelectedSubmissions(prev => prev.filter(id => id !== submissionId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedSubmissions(submissions.map(sub => sub.submissionId));
    } else {
      setSelectedSubmissions([]);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedSubmissions.length === 0) return;
    
    if (!confirm(`Delete ${selectedSubmissions.length} submission(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);

      const response = await fetch("/api/cta/submissions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionIds: selectedSubmissions
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete submissions");
      }

      const data = await response.json();
      
      if (data.success) {
        // eslint-disable-next-line no-console
        console.log(`Deleted ${data.deletedCount} submissions`);
        // eslint-disable-next-line no-console
        if (data.errors.length > 0) {
          console.warn("Some deletions failed:", data.errors);
        }
        
        // Refresh the list
        setSelectedSubmissions([]);
        await loadSubmissions();
      } else {
        throw new Error("Failed to delete submissions");
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Bulk delete error:", error);
      setError(error instanceof Error ? error.message : "Failed to delete submissions");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Build query parameters with current filters
      const params = new URLSearchParams({ format: "csv" });
      if (filters.status) params.set("status", filters.status);
      if (filters.avatarId) params.set("avatarId", filters.avatarId);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const response = await fetch(`/api/cta/submissions?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to export submissions");
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cta-submissions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Export error:", error);
      setError(error instanceof Error ? error.message : "Failed to export submissions");
    } finally {
      setIsExporting(false);
    }
  };

  // Pagination
  const handlePreviousPage = () => {
    if (pagination.offset > 0) {
      setPagination(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit)
      }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
    }
  };

  // Status Color Helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed": return "success";
      case "failed": return "danger";
      case "pending": return "warning";
      default: return "default";
    }
  };

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
          <h1 className={title()}>CTA Submissions</h1>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<Filter className="w-4 h-4" />}
            onPress={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadSubmissions}
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Filters</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                label="Search"
                placeholder="Search by name or email..."
                value={filters.search}
                onValueChange={(value) => handleFilterChange("search", value)}
                startContent={<Search className="w-4 h-4" />}
              />
              
              <Select
                label="Status"
                placeholder="All statuses"
                selectedKeys={filters.status ? [filters.status] : []}
                onSelectionChange={(keys) => {
                  const status = Array.from(keys)[0] as string || "";
                  handleFilterChange("status", status);
                }}
              >
                <SelectItem key="pending">Pending</SelectItem>
                <SelectItem key="processed">Processed</SelectItem>
                <SelectItem key="failed">Failed</SelectItem>
              </Select>

              <Input
                label="Avatar ID"
                placeholder="Filter by avatar..."
                value={filters.avatarId}
                onValueChange={(value) => handleFilterChange("avatarId", value)}
              />

              <Input
                type="date"
                label="Start Date"
                value={filters.startDate}
                onValueChange={(value) => handleFilterChange("startDate", value)}
              />

              <Input
                type="date"
                label="End Date"
                value={filters.endDate}
                onValueChange={(value) => handleFilterChange("endDate", value)}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedSubmissions.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <p className="text-sm">
                {selectedSubmissions.length} submission(s) selected
              </p>
              <div className="flex gap-2">
                <Button
                  color="danger"
                  variant="bordered"
                  startContent={<Trash2 className="w-4 h-4" />}
                  onPress={handleBulkDelete}
                  isLoading={isDeleting}
                >
                  Delete Selected
                </Button>
                <Button
                  variant="bordered"
                  startContent={<Download className="w-4 h-4" />}
                  onPress={handleExport}
                  isLoading={isExporting}
                >
                  Export CSV
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                Submissions ({pagination.total})
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                isSelected={selectedSubmissions.length === submissions.length && submissions.length > 0}
                isIndeterminate={selectedSubmissions.length > 0 && selectedSubmissions.length < submissions.length}
                onValueChange={handleSelectAll}
              >
                Select All
              </Checkbox>
            </div>
          </div>
        </CardHeader>
        
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No submissions found</p>
              <p className="text-sm">
                {Object.values(filters).some(v => v) 
                  ? "Try adjusting your filters"
                  : "Submissions will appear here when users submit the CTA form"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div
                  key={submission.submissionId}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Checkbox
                    isSelected={selectedSubmissions.includes(submission.submissionId)}
                    onValueChange={(selected) => 
                      handleSelectSubmission(submission.submissionId, selected)
                    }
                  />

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <p className="font-medium">{submission.userDetails.name}</p>
                      </div>
                      <p className="text-sm text-gray-600">{submission.userDetails.email}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="w-4 h-4 text-gray-400" />
                        <p className="font-medium">{submission.metadata.avatarName}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        {submission.metadata.messageCount} messages
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <p className="text-sm">
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(submission.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Chip
                        size="sm"
                        color={getStatusColor(submission.status)}
                        variant="flat"
                      >
                        {submission.status}
                      </Chip>
                      {submission.emailSent && (
                        <Chip size="sm" color="success" variant="flat">
                          Email Sent
                        </Chip>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="light"
                    startContent={<Eye className="w-4 h-4" />}
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

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {pagination.offset + 1} to{" "}
            {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
            {pagination.total} submissions
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="bordered"
              size="sm"
              onPress={handlePreviousPage}
              isDisabled={pagination.offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="bordered"
              size="sm"
              onPress={handleNextPage}
              isDisabled={!pagination.hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}