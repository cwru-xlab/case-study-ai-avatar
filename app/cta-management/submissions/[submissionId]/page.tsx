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
  Mail, 
  MessageSquare, 
  Bot, 
  Clock, 
  Calendar,
  Globe,
  Monitor,
  Hash,
  Download,
  Trash2,
  RefreshCw,
  Copy
} from "lucide-react";
import { title } from "@/components/primitives";
import type { CTASubmission, ChatSession } from "@/types";

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.submissionId as string;

  const [submission, setSubmission] = useState<CTASubmission | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // Load Submission Data
  useEffect(() => {
    if (submissionId) {
      loadSubmissionData();
    }
  }, [submissionId]);

  const loadSubmissionData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load submission details
      const submissionResponse = await fetch(`/api/cta/submissions/${submissionId}`);
      
      if (!submissionResponse.ok) {
        if (submissionResponse.status === 404) {
          throw new Error("Submission not found");
        }
        throw new Error("Failed to load submission");
      }

      const submissionData = await submissionResponse.json();
      
      if (submissionData.success) {
        setSubmission(submissionData.submission);
        
        // Load associated chat session
        const chatResponse = await fetch(`/api/cta/transcript/${submissionData.submission.sessionId}`);
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          if (chatData.success) {
            setChatSession(chatData.chatSession);
          }
        }
      } else {
        throw new Error(submissionData.error || "Failed to load submission");
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load submission:", error);
      setError(error instanceof Error ? error.message : "Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  // Copy to Clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy to clipboard:", error);
    }
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

  // Get Status Color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed": return "success";
      case "failed": return "danger";
      case "pending": return "warning";
      default: return "default";
    }
  };

  // Handle Delete Submission
  const handleDelete = async () => {
    if (!submission) return;
    
    if (!confirm("Delete this submission? This action cannot be undone.")) {
      return;
    }

    try {
      setActionLoading("delete");

      const response = await fetch("/api/cta/submissions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionIds: [submission.submissionId]
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete submission");
      }

      // Navigate back to submissions list
      router.push("/cta-management/submissions");

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Delete error:", error);
      setError(error instanceof Error ? error.message : "Failed to delete submission");
    } finally {
      setActionLoading(null);
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
            onPress={() => router.push("/cta-management/submissions")}
          >
            Back
          </Button>
          <h1 className={title()}>Submission Details</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/cta-management/submissions")}
          >
            Back
          </Button>
          <h1 className={title()}>Submission Details</h1>
        </div>
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      </div>
    );
  }

  if (!submission) {
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
            onPress={() => router.push("/cta-management/submissions")}
          >
            Back
          </Button>
          <div>
            <h1 className={title()}>Submission Details</h1>
            <p className="text-gray-600 text-sm mt-1">
              ID: {submission.submissionId}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            color="danger"
            variant="bordered"
            startContent={<Trash2 className="w-4 h-4" />}
            onPress={handleDelete}
            isLoading={actionLoading === "delete"}
          >
            Delete
          </Button>
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadSubmissionData}
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Submission Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">User Information</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{submission.userDetails.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{submission.userDetails.email}</p>
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      onPress={() => copyToClipboard(submission.userDetails.email)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {submission.userDetails.message && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Message</p>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="whitespace-pre-wrap">{submission.userDetails.message}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Chat Session Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold">Chat Session</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Avatar</p>
                  <p className="font-medium">{submission.metadata.avatarName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Messages</p>
                  <p className="font-medium">{submission.metadata.messageCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium">
                    {formatDuration(submission.metadata.chatDuration)}
                  </p>
                </div>
              </div>
              
              <Divider className="my-4" />
              
              <div className="flex items-center gap-2">

                <Button
                  size="sm"
                  variant="light"
                  startContent={<Copy className="w-4 h-4" />}
                  onPress={() => copyToClipboard(submission.sessionId)}
                >
                  Copy Session ID
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Chat Transcript Preview */}
          {chatSession && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold">
                    {showFullTranscript ? "Full Chat Transcript" : "Chat Transcript Preview"}
                  </h2>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(showFullTranscript ? chatSession.messages : chatSession.messages.slice(0, 5)).map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3 h-3 text-white" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] p-3 rounded-lg text-sm ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {message.content.length > 200 
                            ? message.content.substring(0, 200) + "..."
                            : message.content
                          }
                        </div>
                        <div className={`text-xs mt-1 ${
                          message.role === "user" ? "text-blue-100" : "text-gray-500"
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>

                      {message.role === "user" && (
                        <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {chatSession.messages.length > 5 && (
                    <div className="text-center py-2">
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => setShowFullTranscript(!showFullTranscript)}
                      >
                        {showFullTranscript 
                          ? "Show preview only" 
                          : `View full transcript (${chatSession.messages.length - 5} more messages)`
                        }
                      </Button>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right Column - Status & Metadata */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Status</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">Processing Status</p>
                <Chip
                  color={getStatusColor(submission.status)}
                  variant="flat"
                  size="lg"
                >
                  {submission.status}
                </Chip>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Email Status</p>
                <Chip
                  color={submission.emailSent ? "success" : "danger"}
                  variant="flat"
                >
                  {submission.emailSent ? "Email Sent" : "Email Not Sent"}
                </Chip>
              </div>

              {submission.errorMessage && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Error Message</p>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{submission.errorMessage}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold">Timeline</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Submitted</p>
                <p className="font-medium">
                  {new Date(submission.createdAt).toLocaleString()}
                </p>
              </div>

              {submission.processedAt && (
                <div>
                  <p className="text-sm text-gray-500">Processed</p>
                  <p className="font-medium">
                    {new Date(submission.processedAt).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Chat Date</p>
                <p className="font-medium">
                  {new Date(submission.metadata.submittedAt).toLocaleString()}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold">Technical Details</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {submission.metadata.ipAddress && (
                <div>
                  <p className="text-sm text-gray-500">IP Address</p>
                  <p className="font-mono text-sm">{submission.metadata.ipAddress}</p>
                </div>
              )}

              {submission.metadata.userAgent && (
                <div>
                  <p className="text-sm text-gray-500">User Agent</p>
                  <p className="text-xs text-gray-600 break-all">
                    {submission.metadata.userAgent}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Session ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs">{submission.sessionId}</p>
                  <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    onPress={() => copyToClipboard(submission.sessionId)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}