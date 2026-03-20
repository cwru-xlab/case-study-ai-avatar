"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import {
  ArrowLeft,
  Play,
  Eye,
  Users,
  Send,
  LogOut,
  CheckCircle,
  MessageSquare,
  Clock,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import type { CaseStudy, CaseAvatar, InteractionLog, RoleMessage, InteractionEvent } from "@/types";

type PageState = "intro" | "playing";

export default function CasePlayPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const caseId = params.caseId as string;
  const cohortId = searchParams.get("cohortId") || "";

  const [caseData, setCaseData] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageState, setPageState] = useState<PageState>("intro");
  const [interactionLog, setInteractionLog] = useState<InteractionLog | null>(null);
  const [mode, setMode] = useState<"explore" | "assessed">("assessed");

  // Role interaction state
  const [selectedRole, setSelectedRole] = useState<CaseAvatar | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, RoleMessage[]>>({});
  const [currentInput, setCurrentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Load case data
  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await fetch(`/api/case/get?id=${encodeURIComponent(caseId)}`);
      if (!res.ok) throw new Error("Case not found");
      const data = await res.json();
      setCaseData(data.caseStudy);
    } catch (err) {
      console.error("Failed to load case:", err);
      addToast({ title: "Failed to load case", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, selectedRole]);

  // Auto-save every 15 seconds for assessed mode
  useEffect(() => {
    if (pageState === "playing" && mode === "assessed" && interactionLog) {
      autoSaveRef.current = setInterval(() => {
        saveInteraction(interactionLog);
      }, 15000);

      return () => {
        if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      };
    }
  }, [pageState, mode, interactionLog]);

  const saveInteraction = async (log: InteractionLog) => {
    if (log.mode !== "assessed") return;
    try {
      await fetch("/api/interaction/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log }),
      });
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  };

  const handleStart = async (selectedMode: "explore" | "assessed") => {
    if (!user?.email || !caseData) return;

    setMode(selectedMode);

    try {
      const res = await fetch("/api/interaction/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: user.email,
          studentName: user.name,
          caseId: caseData.id,
          caseName: caseData.name,
          cohortId,
          mode: selectedMode,
        }),
      });

      if (!res.ok) throw new Error("Failed to start interaction");
      const data = await res.json();
      setInteractionLog(data.log);
      setChatMessages({});
      setPageState("playing");
    } catch (err) {
      console.error("Failed to start:", err);
      addToast({ title: "Failed to start session", color: "danger" });
    }
  };

  const handleSelectRole = (role: CaseAvatar) => {
    if (!interactionLog) return;

    const now = Date.now();

    // If we were in another role, add exit event
    if (selectedRole && selectedRole.id !== role.id) {
      const exitEvent: InteractionEvent = {
        type: "exit_role",
        roleId: selectedRole.id,
        roleName: selectedRole.name,
        timestamp: now,
      };
      interactionLog.events.push(exitEvent);

      // Update the exitedAt for the previous role
      if (interactionLog.roleInteractions[selectedRole.id]) {
        interactionLog.roleInteractions[selectedRole.id].exitedAt = now;
      }
    }

    // Add enter event
    const enterEvent: InteractionEvent = {
      type: "enter_role",
      roleId: role.id,
      roleName: role.name,
      timestamp: now,
    };
    interactionLog.events.push(enterEvent);

    // Ensure role interaction exists
    if (!interactionLog.roleInteractions[role.id]) {
      interactionLog.roleInteractions[role.id] = {
        roleId: role.id,
        roleName: role.name,
        messages: [],
        enteredAt: now,
      };
    } else {
      // Re-entering an existing role
      interactionLog.roleInteractions[role.id].enteredAt = now;
      interactionLog.roleInteractions[role.id].exitedAt = undefined;
    }

    setSelectedRole(role);
    setInteractionLog({ ...interactionLog });
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim() || !selectedRole || !interactionLog || !caseData) return;

    const userMessage = currentInput.trim();
    setCurrentInput("");
    setSending(true);

    const now = Date.now();

    // Add user message
    const userMsg: RoleMessage = { role: "user", content: userMessage, timestamp: now };
    const roleId = selectedRole.id;

    // Update local chat state
    setChatMessages((prev) => ({
      ...prev,
      [roleId]: [...(prev[roleId] || []), userMsg],
    }));

    // Update interaction log
    interactionLog.roleInteractions[roleId].messages.push(userMsg);
    interactionLog.events.push({
      type: "send_message",
      roleId,
      roleName: selectedRole.name,
      timestamp: now,
      messageContent: userMessage,
      messageRole: "user",
    });

    try {
      // Get the chat history for this role only (continuous within this role)
      const roleHistory = interactionLog.roleInteractions[roleId].messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/interaction/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: roleHistory,
          systemPrompt: `Background information about this case study:\n${caseData.backgroundInfo}`,
          roleContext: {
            roleName: selectedRole.name,
            role: selectedRole.role,
            additionalInfo: selectedRole.additionalInfo,
          },
        }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();

      const assistantMsg: RoleMessage = {
        role: "assistant",
        content: data.message,
        timestamp: Date.now(),
      };

      setChatMessages((prev) => ({
        ...prev,
        [roleId]: [...(prev[roleId] || []), assistantMsg],
      }));

      interactionLog.roleInteractions[roleId].messages.push(assistantMsg);
      interactionLog.events.push({
        type: "receive_message",
        roleId,
        roleName: selectedRole.name,
        timestamp: Date.now(),
        messageContent: data.message,
        messageRole: "assistant",
      });

      setInteractionLog({ ...interactionLog });
    } catch (err) {
      console.error("Chat error:", err);
      addToast({ title: "Failed to get response", color: "danger" });
    } finally {
      setSending(false);
    }
  };

  const handleFinish = async () => {
    if (!interactionLog) return;

    setFinishing(true);
    try {
      // Clear auto-save
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);

      const res = await fetch("/api/interaction/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log: interactionLog }),
      });

      if (!res.ok) throw new Error("Failed to finish");

      addToast({
        title: mode === "assessed"
          ? "Session completed! Your evaluation is being processed."
          : "Explore session completed.",
        color: "success",
      });

      router.push("/student-cases");
    } catch (err) {
      console.error("Finish error:", err);
      addToast({ title: "Failed to end session", color: "danger" });
    } finally {
      setFinishing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading case..." />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-danger text-lg mb-4">Case not found</p>
        <Button onPress={() => router.push("/student-cases")} startContent={<ArrowLeft className="w-4 h-4" />}>
          Back to Cases
        </Button>
      </div>
    );
  }

  // INTRO PAGE
  if (pageState === "intro") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button isIconOnly variant="light" onPress={() => router.push("/student-cases")}>
            <ArrowLeft />
          </Button>
          <h1 className={title({ size: "sm" })}>{caseData.name}</h1>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Background Information</h2>
          </CardHeader>
          <CardBody>
            <p className="text-default-700 whitespace-pre-wrap leading-relaxed">
              {caseData.backgroundInfo}
            </p>
          </CardBody>
        </Card>

        {caseData.avatars && caseData.avatars.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h2 className="text-xl font-semibold">People You Can Talk To</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3">
                {caseData.avatars.map((avatar) => (
                  <div key={avatar.id} className="p-4 bg-default-50 rounded-lg">
                    <p className="font-semibold">{avatar.name}</p>
                    <p className="text-sm text-default-500">{avatar.role}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <div className="flex gap-4 justify-center pt-4">
          <Button
            size="lg"
            variant="bordered"
            startContent={<Eye className="w-5 h-5" />}
            onPress={() => handleStart("explore")}
          >
            Explore System
          </Button>
          <Button
            size="lg"
            color="primary"
            startContent={<Play className="w-5 h-5" />}
            onPress={() => handleStart("assessed")}
          >
            Start
          </Button>
        </div>
        <p className="text-center text-sm text-default-400">
          &quot;Explore System&quot; lets you try the case without recording.
          &quot;Start&quot; begins an assessed attempt.
        </p>
      </div>
    );
  }

  // PLAYING PAGE
  const currentRoleMessages = selectedRole ? (chatMessages[selectedRole.id] || []) : [];

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {/* Left sidebar - Roles */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Roles</h3>
          <Chip size="sm" variant="flat" color={mode === "assessed" ? "primary" : "default"}>
            {mode === "assessed" ? "Assessed" : "Explore"}
          </Chip>
        </div>

        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {caseData.avatars?.map((avatar) => {
            const msgCount = (chatMessages[avatar.id] || []).length;
            const isSelected = selectedRole?.id === avatar.id;
            return (
              <Card
                key={avatar.id}
                isPressable
                className={`transition-all ${isSelected ? "border-2 border-primary bg-primary/5" : "hover:bg-default-50"}`}
                onPress={() => handleSelectRole(avatar)}
              >
                <CardBody className="p-3">
                  <p className="font-medium text-sm">{avatar.name}</p>
                  <p className="text-xs text-default-500 line-clamp-1">{avatar.role}</p>
                  {msgCount > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <MessageSquare className="w-3 h-3 text-default-400" />
                      <span className="text-xs text-default-400">{msgCount} messages</span>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>

        <Button
          color="danger"
          variant="flat"
          startContent={<CheckCircle className="w-4 h-4" />}
          onPress={handleFinish}
          isLoading={finishing}
          className="w-full"
        >
          I&apos;m Finished
        </Button>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
        {!selectedRole ? (
          <div className="flex-1 flex items-center justify-center text-default-400">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a person to talk to</p>
              <p className="text-sm">Choose from the roles on the left</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-4 border-b bg-default-50 flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedRole.name}</p>
                <p className="text-sm text-default-500">{selectedRole.role}</p>
              </div>
              <Button
                size="sm"
                variant="light"
                startContent={<LogOut className="w-4 h-4" />}
                onPress={() => {
                  if (interactionLog && selectedRole) {
                    const now = Date.now();
                    interactionLog.events.push({
                      type: "exit_role",
                      roleId: selectedRole.id,
                      roleName: selectedRole.name,
                      timestamp: now,
                    });
                    if (interactionLog.roleInteractions[selectedRole.id]) {
                      interactionLog.roleInteractions[selectedRole.id].exitedAt = now;
                    }
                    setInteractionLog({ ...interactionLog });
                  }
                  setSelectedRole(null);
                }}
              >
                Leave
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentRoleMessages.length === 0 && (
                <div className="text-center text-default-400 py-8">
                  <p>Start a conversation with {selectedRole.name}</p>
                </div>
              )}
              {currentRoleMessages.map((msg, idx) => (
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
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.role === "user" ? "text-primary-foreground/60" : "text-default-400"}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-default-100 p-3 rounded-lg">
                    <Spinner size="sm" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder={`Message ${selectedRole.name}...`}
                  value={currentInput}
                  onValueChange={setCurrentInput}
                  onKeyDown={handleKeyDown}
                  isDisabled={sending}
                  className="flex-1"
                />
                <Button
                  isIconOnly
                  color="primary"
                  onPress={handleSendMessage}
                  isLoading={sending}
                  isDisabled={!currentInput.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
