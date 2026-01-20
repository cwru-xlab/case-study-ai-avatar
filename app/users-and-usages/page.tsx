"use client";
// This file uses React hooks (useEffect, useState) and must be a client component.
import { title } from "@/components/primitives";
import { useEffect, useState } from "react";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Trash2, Eye, Filter, X, ExternalLink, Download } from "lucide-react";
import type { ChatSessionMetadata } from "@/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { User, Bot } from "lucide-react";
import type { ChatSession } from "@/types";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { DatePicker } from "@heroui/date-picker";
import { parseDate, type DateValue } from "@internationalized/date";
import { avatarStorage, type CachedAvatar } from "@/lib/avatar-storage";

// Utility to format timestamps as readable dates
function formatDate(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

// Filter state interface
interface FilterState {
  sessionId: string;
  avatarId: string;
  userId: string;
  startDate: string;
  endDate: string;
  limit: string;
}

// Chat Sessions Table Component
function ChatSessionsTable() {
  // State for chat sessions, loading, and error
  const [sessions, setSessions] = useState<ChatSessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSession, setModalSession] = useState<ChatSession | null>(null);

  // State for filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    sessionId: "",
    avatarId: "",
    userId: "",
    startDate: "",
    endDate: "",
    limit: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    sessionId: "",
    avatarId: "",
    userId: "",
    startDate: "",
    endDate: "",
    limit: "",
  });

  // State for available avatars
  const [avatars, setAvatars] = useState<CachedAvatar[]>([]);

  // State for download loading
  const [downloading, setDownloading] = useState(false);

  // Load avatars on mount
  useEffect(() => {
    async function loadAvatars() {
      try {
        const avatarList = await avatarStorage.list();
        setAvatars(avatarList);
      } catch (err) {
        console.error("Failed to load avatars:", err);
      }
    }
    loadAvatars();
  }, []);

  // Fetch chat sessions from the API on mount and when applied filters change
  useEffect(() => {
    fetchSessions();
  }, [appliedFilters]);

  // Function to fetch sessions with current filters
  async function fetchSessions() {
    setLoading(true);
    setError(null);
    try {
      // If session ID is provided, use direct get endpoint and ignore other filters
      if (appliedFilters.sessionId.trim()) {
        const res = await fetch(
          `/api/chat/get?sessionId=${encodeURIComponent(appliedFilters.sessionId.trim())}`
        );
        const data = await res.json();

        if (data.success && data.session) {
          // Convert single session to sessions array format
          setSessions([data.session.metadata]);
        } else {
          setError(data.error || "Session not found");
          setSessions([]);
        }
      } else {
        // Use list endpoint with other filters
        const params = new URLSearchParams();
        if (appliedFilters.avatarId)
          params.append("avatarId", appliedFilters.avatarId);
        if (appliedFilters.userId)
          params.append("userId", appliedFilters.userId);
        if (appliedFilters.startDate)
          params.append("startDate", appliedFilters.startDate);
        if (appliedFilters.endDate)
          params.append("endDate", appliedFilters.endDate);
        if (appliedFilters.limit) params.append("limit", appliedFilters.limit);

        const url = `/api/chat/list${params.toString() ? `?${params.toString()}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          setSessions(data.sessions);
        } else {
          setError(data.error || "Unknown error");
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch chat sessions");
    } finally {
      setLoading(false);
    }
  }

  // Handler for deleting a session (admin only)
  async function handleDelete(sessionId: string) {
    if (!confirm(`Delete session ${sessionId}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/chat/delete?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSessions(sessions.filter((s) => s.sessionId !== sessionId));
      } else {
        alert(data.error || "Failed to delete session");
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete session");
    }
  }

  // Handler for viewing a session (show modal with details)
  async function handleView(sessionId: string) {
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalSession(null);
    try {
      const res = await fetch(`/api/chat/get?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setModalSession(data.session);
      } else {
        setModalError(data.error || "Unknown error");
      }
    } catch (e: any) {
      setModalError(e.message || "Failed to fetch session details");
    } finally {
      setModalLoading(false);
    }
  }

  // Filter handlers
  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setShowFilters(false);
  };

  const resetFilters = () => {
    const emptyFilters = {
      sessionId: "",
      avatarId: "",
      userId: "",
      startDate: "",
      endDate: "",
      limit: "",
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const handleDateChange = (date: DateValue | null, type: "start" | "end") => {
    if (date) {
      // Convert DateValue to local time ISO-like string format
      const year = date.year;
      const month = String(date.month).padStart(2, "0");
      const day = String(date.day).padStart(2, "0");
      
      // Set time based on whether it's start or end date for inclusive range
      const hours = type === "start" ? 0 : 23;
      const minutes = type === "start" ? 0 : 59;
      const seconds = type === "start" ? 0 : 59;
      const milliseconds = type === "start" ? 0 : 999;
      
      // Create a Date object in local time
      const localDate = new Date(year, date.month - 1, date.day, hours, minutes, seconds, milliseconds);
      
      // Get timezone offset and format it
      const tzOffset = -localDate.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
      const offsetMinutes = Math.abs(tzOffset) % 60;
      const offsetSign = tzOffset >= 0 ? '+' : '-';
      const timezoneString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
      
      // Construct local time ISO string with appropriate time
      const timeString = type === "start" ? "00:00:00.000" : "23:59:59.999";
      const dateString = `${year}-${month}-${day}T${timeString}${timezoneString}`;

      setFilters((prev) => ({
        ...prev,
        [type === "start" ? "startDate" : "endDate"]: dateString,
      }));
    }
  };

  // Check if any filters are applied
  const hasActiveFilters = Object.values(appliedFilters).some(
    (value) => value !== ""
  );

  // Handler for opening chat in new page
  const handleViewChatInNewPage = (sessionId: string) => {
    window.open(`/chat/view/${sessionId}`, "_blank");
  };

  // Handler for downloading chat sessions
  const handleDownloadSessions = async () => {
    if (sessions.length === 0) {
      alert("No sessions to download");
      return;
    }

    setDownloading(true);
    try {
      const sessionIds = sessions.map((session) => session.sessionId);

      // Generate descriptive filename based on filters
      let filename = "chat-sessions";
      if (appliedFilters.sessionId.trim()) {
        filename = `chat-session-${appliedFilters.sessionId.trim()}`;
      } else if (appliedFilters.avatarId) {
        filename = `chat-sessions-${appliedFilters.avatarId}`;
      } else if (appliedFilters.userId) {
        filename = `chat-sessions-user-${appliedFilters.userId}`;
      } else if (hasActiveFilters) {
        filename = "chat-sessions-filtered";
      } else {
        filename = "chat-sessions-all";
      }
      filename += `-${new Date().toISOString().split("T")[0]}`;

      const response = await fetch("/api/chat/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionIds,
          filename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Download failed");
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setDownloading(false);
    }
  };

  // Render loading, error, or table
  if (loading) return <Spinner label="Loading chat sessions..." />;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <>
      {/* Filter Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              startContent={<Filter size={16} />}
              variant={showFilters ? "solid" : "bordered"}
              color={hasActiveFilters ? "primary" : "default"}
              onPress={() => setShowFilters(!showFilters)}
            >
              Filters{" "}
              {hasActiveFilters &&
                `(${Object.values(appliedFilters).filter((v) => v !== "").length})`}
            </Button>
            {hasActiveFilters && (
              <Button
                startContent={<X size={16} />}
                variant="light"
                color="danger"
                onPress={resetFilters}
                size="sm"
              >
                Clear All
              </Button>
            )}
            <Button
              startContent={downloading ? undefined : <Download size={16} />}
              variant="bordered"
              color="success"
              onPress={handleDownloadSessions}
              isDisabled={sessions.length === 0 || downloading}
              isLoading={downloading}
            >
              {downloading
                ? "Preparing Download..."
                : `Download (${sessions.length})`}
            </Button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {appliedFilters.sessionId.trim() ? (
              sessions.length > 0 ? (
                <span className="text-green-600 dark:text-green-400">
                  ✓ Session found
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  ✗ Session not found
                </span>
              )
            ) : (
              `${sessions.length} session${sessions.length !== 1 ? "s" : ""} found`
            )}
          </div>
        </div>

        {showFilters && (
          <Card className="p-4">
            {/* Session ID Filter - Featured prominently */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Input
                label="Session ID"
                placeholder="Enter specific session ID (overrides other filters)"
                value={filters.sessionId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, sessionId: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filters.sessionId.trim()) {
                    applyFilters();
                  }
                }}
                description="When provided, only this session will be searched (other filters ignored). Press Enter to search immediately."
                className="font-mono"
              />
            </div>

            {/* Divider when session ID is present */}
            {filters.sessionId.trim() && (
              <div className="mb-4 text-center text-sm text-gray-500">
                <span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
                  Other filters are disabled when Session ID is specified
                </span>
              </div>
            )}

            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${filters.sessionId.trim() ? "opacity-50" : ""}`}
            >
              {/* Avatar Filter */}
              <Select
                label="Avatar"
                placeholder="Select an avatar"
                selectedKeys={filters.avatarId ? [filters.avatarId] : []}
                onSelectionChange={(keys) => {
                  const value = (Array.from(keys)[0] as string) || "";
                  setFilters((prev) => ({ ...prev, avatarId: value }));
                }}
                isDisabled={!!filters.sessionId.trim()}
              >
                {avatars.map((avatar) => (
                  <SelectItem key={avatar.id}>{avatar.name}</SelectItem>
                ))}
              </Select>

              {/* User Filter */}
              <Input
                label="User ID"
                placeholder="Enter user ID"
                value={filters.userId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, userId: e.target.value }))
                }
                isDisabled={!!filters.sessionId.trim()}
              />

              {/* Limit Filter */}
              <Input
                label="Limit Results"
                placeholder="e.g., 100"
                type="number"
                value={filters.limit}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, limit: e.target.value }))
                }
                isDisabled={!!filters.sessionId.trim()}
              />

              {/* Start Date Filter */}
              <DatePicker
                label="Start Date"
                value={
                  filters.startDate
                    ? parseDate(filters.startDate.split("T")[0])
                    : null
                }
                onChange={(date) => handleDateChange(date, "start")}
                isDisabled={!!filters.sessionId.trim()}
                showMonthAndYearPickers
              />

              {/* End Date Filter */}
              <DatePicker
                label="End Date"
                value={
                  filters.endDate
                    ? parseDate(filters.endDate.split("T")[0])
                    : null
                }
                onChange={(date) => handleDateChange(date, "end")}
                isDisabled={!!filters.sessionId.trim()}
                showMonthAndYearPickers
              />
            </div>

            {/* Filter Actions */}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="light" onPress={resetFilters}>
                Reset
              </Button>
              <Button color="primary" onPress={applyFilters}>
                Apply Filters
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Results Summary */}
      {sessions.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          {hasActiveFilters
            ? "No sessions match your filters."
            : "No chat sessions found."}
        </div>
      )}

      {/* Table */}
      {sessions.length > 0 && (
        <div className="overflow-x-auto mt-8">
          <table className="min-w-full border text-sm bg-white dark:bg-black">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="p-2 border">Session ID</th>
                <th className="p-2 border">Avatar</th>
                <th className="p-2 border">Start</th>
                <th className="p-2 border">End</th>
                <th className="p-2 border">Messages</th>
                <th className="p-2 border">Kiosk?</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td
                    className="p-2 border font-mono truncate max-w-xs"
                    title={s.sessionId}
                  >
                    {s.sessionId}
                  </td>
                  <td className="p-2 border">{s.avatarName}</td>
                  <td className="p-2 border">{formatDate(s.startTime)}</td>
                  <td className="p-2 border">{formatDate(s.endTime)}</td>
                  <td className="p-2 border text-center">{s.messageCount}</td>
                  <td className="p-2 border text-center">
                    <Chip
                      size="sm"
                      color={s.isKioskMode ? "success" : "default"}
                    >
                      {s.isKioskMode ? "Yes" : "No"}
                    </Chip>
                  </td>
                  <td className="p-2 border flex gap-2">
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => handleView(s.sessionId)}
                      title="View session details"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="success"
                      onPress={() =>
                        window.open(
                          `/api/chat/download?sessionId=${s.sessionId}`
                        )
                      }
                      title="Download single session"
                    >
                      <Download size={16} />
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => handleDelete(s.sessionId)}
                      title="Delete session"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Session Details Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-3 border-b border-default-200">
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">Session Details</span>
                  {modalSession && (
                    <span className="text-xs text-default-500 font-mono">
                      Session ID: {modalSession.metadata.sessionId}
                    </span>
                  )}
                </div>
              </ModalHeader>
              <ModalBody className="flex flex-col h-[60vh]">
                {modalLoading && (
                  <div className="p-8 text-center">Loading session...</div>
                )}
                {modalError && (
                  <div className="p-8 text-center text-red-500">
                    Error: {modalError}
                  </div>
                )}
                {modalSession && (
                  <>
                    {/* Metadata */}
                    <div className="mb-4 text-sm text-default-700 dark:text-default-300">
                      <div>
                        <b>Avatar:</b> {modalSession.metadata.avatarName} (
                        {modalSession.metadata.avatarId})
                      </div>
                      <div>
                        <b>User:</b>{" "}
                        {modalSession.metadata.userId || (
                          <span className="text-gray-400">(anon)</span>
                        )}
                      </div>
                      <div>
                        <b>Start:</b>{" "}
                        {formatDate(modalSession.metadata.startTime)}
                      </div>
                      <div>
                        <b>End:</b> {formatDate(modalSession.metadata.endTime)}
                      </div>
                      <div>
                        <b>Messages:</b> {modalSession.metadata.messageCount}
                      </div>
                      <div>
                        <b>Kiosk Mode:</b>{" "}
                        {modalSession.metadata.isKioskMode ? "Yes" : "No"}
                      </div>
                      {modalSession.metadata.location && (
                        <div>
                          <b>Location:</b> {modalSession.metadata.location}
                        </div>
                      )}
                    </div>
                    {/* Messages */}
                    <ScrollShadow className="flex-1 px-2 py-2 bg-default-100 rounded">
                      {modalSession.messages.length === 0 && (
                        <div className="text-center text-default-500">
                          No messages in this session.
                        </div>
                      )}
                      <div className="space-y-4">
                        {modalSession.messages.map((message, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            {message.role === "assistant" && (
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-primary-foreground" />
                              </div>
                            )}
                            <div
                              className={`max-w-[75%] p-3 rounded-lg ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-default-700 text-default-700 dark:text-default-100"}`}
                            >
                              <p className="whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              <p className="text-xs opacity-60 mt-1">
                                {formatDate(message.timestamp)}
                              </p>
                            </div>
                            {message.role === "user" && (
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-secondary-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollShadow>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                {modalSession && (
                  <Button
                    onPress={() =>
                      handleViewChatInNewPage(modalSession.metadata.sessionId)
                    }
                    startContent={<ExternalLink size={16} />}
                    variant="bordered"
                    color="primary"
                  >
                    View Chat on New Page
                  </Button>
                )}
                <Button onPress={onClose} color="primary" variant="flat">
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

// Main Users and Usages Page (with Chat Sessions section)
export default function UsersAndUsagesPage() {
  return (
    <div className="w-full">
      <h1 className={title()}>Users and Usages</h1>
      {/* Removed await get("greeting") because this is now a client component. */}
      <p>
        Welcome to the admin dashboard. Use the sections below to manage users,
        usage, and chat sessions.
      </p>
      {/* Chat Sessions Admin Section */}
      <section className="mt-12 w-full">
        <h2 className="text-xl font-bold mb-4">Chat Sessions</h2>
        <p className="mb-2 text-gray-600 dark:text-gray-400">
          View, search, and manage all chat sessions stored in the system. Use
          the actions to view or delete sessions.
        </p>
        <Card className="p-4">
          <ChatSessionsTable />
        </Card>
      </section>
    </div>
  );
}
