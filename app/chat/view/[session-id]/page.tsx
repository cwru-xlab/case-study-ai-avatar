"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { User, Bot, ArrowLeft, Trash2, Copy, Check } from "lucide-react";
import type { ChatSession } from "@/types";

// Utility to format timestamps as readable dates
function formatDate(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

// Utility to copy text to clipboard
function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }
  // Fallback for older browsers
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    document.body.removeChild(textArea);
    return Promise.resolve(true);
  } catch {
    document.body.removeChild(textArea);
    return Promise.resolve(false);
  }
}

export default function ChatViewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params["session-id"] as string;

  // State for session data, loading, and error
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load session data on mount
  useEffect(() => {
    async function loadSession() {
      if (!sessionId) {
        setError("No session ID provided");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/chat/get?sessionId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();

        if (data.success) {
          setSession(data.session);
        } else {
          setError(data.error || "Session not found");
        }
      } catch (e: any) {
        setError(e.message || "Failed to load session");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  // Handle session deletion
  async function handleDelete() {
    if (!session) return;

    if (
      !confirm(
        `Delete session ${session.metadata.sessionId}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/chat/delete?sessionId=${session.metadata.sessionId}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();

      if (data.success) {
        // Redirect back to admin page after successful deletion
        router.push("/users-and-usages");
      } else {
        alert(data.error || "Failed to delete session");
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete session");
    }
  }

  // Handle copying session ID
  async function handleCopySessionId() {
    if (!session) return;

    const success = await copyToClipboard(session.metadata.sessionId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Handle copying URL
  async function handleCopyUrl() {
    const success = await copyToClipboard(window.location.href);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" label="Loading chat session..." />
          <p className="mt-4 text-gray-500">Loading session: {sessionId}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Session Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 font-mono break-all">
              {sessionId}
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="light"
                onPress={() => router.push("/users-and-usages")}
              >
                <ArrowLeft size={16} />
                Back to Admin
              </Button>
              <Button color="primary" onPress={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p className="text-gray-600 mb-6">
            The requested chat session could not be found.
          </p>
          <Button
            variant="light"
            onPress={() => router.push("/users-and-usages")}
          >
            <ArrowLeft size={16} />
            Back to Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="light"
                onPress={() => router.push("/users-and-usages")}
              >
                <ArrowLeft size={16} />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Chat Session</h1>
                <p className="text-sm text-gray-500">
                  {session.metadata.avatarName} •{" "}
                  {session.metadata.messageCount} messages
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="light"
                onPress={handleCopySessionId}
                startContent={copied ? <Check size={16} /> : <Copy size={16} />}
              >
                {copied ? "Copied!" : "Copy ID"}
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={handleCopyUrl}
                startContent={copied ? <Check size={16} /> : <Copy size={16} />}
              >
                {copied ? "Copied!" : "Copy URL"}
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="light"
                onPress={handleDelete}
              >
                <Trash2 size={16} />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Session Metadata */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Session Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Session ID
                  </label>
                  <div className="mt-1 font-mono text-sm break-all bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {session.metadata.sessionId}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Avatar
                  </label>
                  <div className="mt-1 font-semibold">
                    {session.metadata.avatarName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {session.metadata.avatarId}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    User
                  </label>
                  <div className="mt-1">
                    {session.metadata.userId ? (
                      <span className="font-semibold">
                        {session.metadata.userId}
                      </span>
                    ) : (
                      <span className="text-gray-400">(Anonymous)</span>
                    )}
                  </div>
                  {session.metadata.userName && (
                    <div className="text-sm text-gray-500">
                      {session.metadata.userName}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Mode
                  </label>
                  <div className="mt-1">
                    <Chip
                      size="sm"
                      color={
                        session.metadata.isKioskMode ? "success" : "default"
                      }
                    >
                      {session.metadata.isKioskMode
                        ? "Kiosk Mode"
                        : "Preview Mode"}
                    </Chip>
                  </div>
                </div>

                {session.metadata.location && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Location
                    </label>
                    <div className="mt-1">{session.metadata.location}</div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Timeline
                  </label>
                  <div className="mt-1 space-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Started:</span>{" "}
                      {formatDate(session.metadata.startTime)}
                    </div>
                    <div>
                      <span className="text-gray-500">Ended:</span>{" "}
                      {formatDate(session.metadata.endTime)}
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>{" "}
                      {session.metadata.endTime && session.metadata.startTime
                        ? `${Math.round((session.metadata.endTime - session.metadata.startTime) / 1000 / 60)} minutes`
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Messages
                  </label>
                  <div className="mt-1 font-semibold">
                    {session.metadata.messageCount} total
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Chat Messages */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Conversation</h2>

              {session.messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bot size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No messages in this session.</p>
                </div>
              ) : (
                <ScrollShadow className="max-h-[70vh]">
                  <div className="space-y-4">
                    {session.messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-4 p-4 rounded-lg ${
                          message.role === "user"
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : "bg-gray-50 dark:bg-gray-800"
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {message.role === "user" ? (
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                              <User size={20} className="text-white" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                              <Bot size={20} className="text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm">
                              {message.role === "user"
                                ? "User"
                                : session.metadata.avatarName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(message.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollShadow>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
