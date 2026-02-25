"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Spinner } from "@heroui/spinner";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Send,
  User as UserIcon,
  Bot,
  Phone,
  PhoneOff,
} from "lucide-react";
import { Input } from "@heroui/input";
import { title as pageTitle } from "@/components/primitives";
import { caseStorage } from "@/lib/case-storage";
import type { CaseStudy, CaseAvatar, VideoAudioProfile, StartAvatarRequest } from "@/types";
import InteractiveAvatarWrapper, {
  type InteractiveAvatarRef,
} from "@/components/HeyGenAvatar/InteractiveAvatar";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function StudentTalkPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;
  const avatarId = params.avatarId as string;

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [caseAvatar, setCaseAvatar] = useState<CaseAvatar | null>(null);
  const [avatarProfile, setAvatarProfile] = useState<VideoAudioProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const avatarRef = useRef<InteractiveAvatarRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await caseStorage.get(caseId);
        if (!data) {
          setError("Case not found");
          return;
        }
        setCaseStudy(data);

        const avatar = data.avatars.find((a) => a.id === avatarId);
        if (!avatar) {
          setError("Executive not found in this case");
          return;
        }
        setCaseAvatar(avatar);

        if (avatar.avatarProfileId) {
          const profileRes = await fetch(
            `/api/profile/get?id=${encodeURIComponent(avatar.avatarProfileId)}`
          );
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setAvatarProfile(profileData.profile);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load conversation data");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [caseId, avatarId]);

  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim() || isAIResponding || !caseAvatar || !caseStudy) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage("");

    const newUserMsg: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, newUserMsg]);
    setIsAIResponding(true);

    try {
      const systemPrompt = caseAvatar.systemPrompt ||
        `You are ${caseAvatar.name}, the ${caseAvatar.role}. ${caseAvatar.additionalInfo}`;

      const allMessages = [
        ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage },
      ];

      const response = await fetch("/api/llm/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          avatarId: caseAvatar.id,
          systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content" && data.content) {
                accumulatedContent = data.content;
              } else if (data.type === "end") {
                break;
              }
            } catch {
              // skip parse errors on partial chunks
            }
          }
        }
      }

      if (accumulatedContent) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: accumulatedContent,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);

        if (avatarRef.current && sessionActive) {
          avatarRef.current.speak(accumulatedContent);
        }
      }
    } catch (err) {
      console.error("Error getting AI response:", err);
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "I apologize, but I'm having trouble responding right now. Please try again.",
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAIResponding(false);
    }
  }, [currentMessage, isAIResponding, caseAvatar, caseStudy, chatMessages, sessionActive]);

  const handleBack = () => {
    router.push(`/student-cases/${caseId}`);
  };

  const avatarConfig: StartAvatarRequest | undefined = avatarProfile
    ? {
        quality: avatarProfile.quality,
        avatarName: avatarProfile.avatarName,
        language: avatarProfile.language,
        voice: avatarProfile.voice,
        knowledgeId: avatarProfile.knowledgeId,
      }
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !caseStudy || !caseAvatar) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button isIconOnly variant="light" onPress={() => router.push("/student-cases")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={pageTitle()}>Error</h1>
        </div>
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-default-500">{error || "Something went wrong"}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <Button isIconOnly variant="light" onPress={handleBack} size="sm">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 shrink-0">
            <span className="text-sm font-bold text-primary-700">
              {caseAvatar.name.split(" ").map((n) => n[0]).join("")}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{caseAvatar.name}</h1>
            <Chip size="sm" variant="flat" color="primary">
              {caseAvatar.role}
            </Chip>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Live Avatar Panel */}
        <div className="w-1/2 flex flex-col gap-3">
          <Card className="flex-1 overflow-hidden">
            <CardBody className="p-0 relative">
              {avatarConfig ? (
                <div className="w-full h-full min-h-[300px]">
                  <InteractiveAvatarWrapper
                    ref={avatarRef}
                    config={avatarConfig}
                    cleanMode={false}
                    autoStart={false}
                    showHistory={false}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] bg-default-100">
                  <div className="text-center">
                    <UserIcon className="mx-auto mb-2 text-default-400" size={48} />
                    <p className="text-default-500">No avatar profile assigned</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Chat Panel */}
        <div className="w-1/2 flex flex-col gap-3">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Conversation</h3>
                {isAIResponding && (
                  <Chip size="sm" variant="flat" color="warning">
                    <div className="flex items-center gap-1">
                      <Spinner size="sm" />
                      Thinking...
                    </div>
                  </Chip>
                )}
              </div>
            </CardHeader>
            <CardBody className="flex-1 overflow-hidden p-0">
              <ScrollShadow className="h-full px-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Bot className="w-10 h-10 mb-3 text-default-300" />
                    <p className="text-default-500 font-medium">
                      Start the conversation
                    </p>
                    <p className="text-sm text-default-400 mt-1 max-w-xs">
                      Type a message below to begin interviewing {caseAvatar.name}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 py-3">
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] p-3 rounded-xl text-sm ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-default-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {message.content}
                          </p>
                          <p className="text-xs opacity-60 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        {message.role === "user" && (
                          <div className="w-7 h-7 rounded-full bg-default-200 flex items-center justify-center shrink-0">
                            <UserIcon className="w-4 h-4 text-default-600" />
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollShadow>
            </CardBody>
            <div className="shrink-0 p-3 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder={`Ask ${caseAvatar.name} a question...`}
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  isDisabled={isAIResponding}
                  size="sm"
                  className="flex-1"
                />
                <Button
                  isIconOnly
                  color="primary"
                  size="sm"
                  type="submit"
                  isDisabled={!currentMessage.trim() || isAIResponding}
                  isLoading={isAIResponding}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
