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
  Bot,
  User as UserIcon,
  MessageSquare,
  MessageSquareOff,
} from "lucide-react";
import { title as pageTitle } from "@/components/primitives";
import { caseStorage } from "@/lib/case-storage";
import type {
  CaseStudy,
  CaseAvatar,
  VideoAudioProfile,
  StartAvatarRequest,
} from "@/types";
import InteractiveAvatarWrapper, {
  type InteractiveAvatarRef,
} from "@/components/HeyGenAvatar/InteractiveAvatar";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const MarkdownMessage = ({ content }: { content: string }) => (
  <ReactMarkdown
    components={{
      code: ({ className, children, ...props }) => {
        const isInline = !className;
        return isInline ? (
          <code
            className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded font-mono text-sm"
            {...props}
          >
            {children}
          </code>
        ) : (
          <code
            className="block bg-gray-800 text-green-400 p-3 rounded my-2 font-mono text-sm overflow-x-auto"
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children, ...props }) => (
        <pre
          className="bg-gray-800 text-green-400 p-3 rounded my-2 font-mono text-sm overflow-x-auto"
          {...props}
        >
          {children}
        </pre>
      ),
      p: ({ children, ...props }) => (
        <p className="mb-2 last:mb-0" {...props}>
          {children}
        </p>
      ),
      strong: ({ children, ...props }) => (
        <strong className="font-bold" {...props}>
          {children}
        </strong>
      ),
      em: ({ children, ...props }) => (
        <em className="italic" {...props}>
          {children}
        </em>
      ),
    }}
  >
    {content}
  </ReactMarkdown>
);

export default function StudentTalkPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;
  const avatarId = params.avatarId as string;

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [caseAvatar, setCaseAvatar] = useState<CaseAvatar | null>(null);
  const [avatarProfile, setAvatarProfile] = useState<VideoAudioProfile | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  // Audio recording state (ported from kiosk push-to-talk)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");

  const avatarRef = useRef<InteractiveAvatarRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIndexRef = useRef<number>(-1);

  // Refs to hold latest values so callbacks never see stale closures
  const caseAvatarRef = useRef<CaseAvatar | null>(null);
  const caseStudyRef = useRef<CaseStudy | null>(null);
  useEffect(() => { caseAvatarRef.current = caseAvatar; }, [caseAvatar]);
  useEffect(() => { caseStudyRef.current = caseStudy; }, [caseStudy]);

  // Pending AI request: when set, triggers sendToAI via effect (avoids side effects in state updaters)
  const [pendingAIRequest, setPendingAIRequest] = useState(false);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);

  const aiInFlightRef = useRef(false);

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

  const sendToAI = useCallback(
    async (messages: ChatMessage[]) => {
      const avatar = caseAvatarRef.current;
      const study = caseStudyRef.current;
      if (!avatar || !study) return;
      if (aiInFlightRef.current) return;
      aiInFlightRef.current = true;

      try {
        setIsAIResponding(true);

        const systemPrompt =
          avatar.systemPrompt ||
          `You are ${avatar.name}, the ${avatar.role}. ${avatar.additionalInfo}`;

        const response = await fetch("/api/llm/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            avatarId: avatar.id,
            systemPrompt,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get AI response");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content" && data.content) {
                  assistantContent = data.content;
                } else if (data.type === "end") {
                  break;
                }
              } catch {
                // skip parse errors on partial chunks
              }
            }
          }
        }

        if (assistantContent) {
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: assistantContent,
            timestamp: Date.now(),
          };
          setChatMessages((prev) => [...prev, assistantMsg]);

          if (avatarRef.current) {
            avatarRef.current.speak(assistantContent);
          }
        }
      } catch (err) {
        console.error("Error getting AI response:", err);
        const errorMsg: ChatMessage = {
          role: "assistant",
          content:
            "I apologize, but I'm having trouble responding right now. Please try again.",
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsAIResponding(false);
        aiInFlightRef.current = false;
      }
    },
    []
  );

  // Effect: when transcription completes, fire sendToAI exactly once
  useEffect(() => {
    if (pendingAIRequest) {
      setPendingAIRequest(false);
      sendToAI([...chatMessagesRef.current]);
    }
  }, [pendingAIRequest, sendToAI]);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === "recording") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const recordingMessage: ChatMessage = {
        role: "user",
        content: "🎤 Recording...",
        timestamp: Date.now(),
      };

      setChatMessages((prev) => {
        const newMessages = [...prev, recordingMessage];
        recordingIndexRef.current = newMessages.length - 1;
        return newMessages;
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        processRecording(recordingIndexRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus("Recording...");
    } catch (err) {
      console.error("Error starting recording:", err);
      setRecordingStatus("Error accessing microphone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processRecording = useCallback(
    async (recordingMessageIndex: number) => {
      if (audioChunksRef.current.length === 0) return;

      setIsTranscribing(true);
      setRecordingStatus("Transcribing...");

      setChatMessages((prev) => {
        const updated = [...prev];
        if (updated[recordingMessageIndex]) {
          updated[recordingMessageIndex] = {
            ...updated[recordingMessageIndex],
            content: "📝 Transcribing...",
          };
        }
        return updated;
      });

      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const response = await fetch("/api/audio/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No reader available");

        let buffer = "";
        let transcribedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "start") {
                  setRecordingStatus("Transcription started...");
                } else if (data.type === "delta") {
                  transcribedText = data.text;
                  setChatMessages((prev) => {
                    const updated = [...prev];
                    if (updated[recordingMessageIndex]) {
                      updated[recordingMessageIndex] = {
                        ...updated[recordingMessageIndex],
                        content: transcribedText,
                      };
                    }
                    return updated;
                  });
                  setRecordingStatus(`Transcribing: "${transcribedText}"`);
                } else if (data.type === "done") {
                  transcribedText = data.text;

                  setChatMessages((prev) => {
                    const finalMessages = [...prev];
                    if (
                      finalMessages[recordingMessageIndex] &&
                      transcribedText.trim()
                    ) {
                      finalMessages[recordingMessageIndex] = {
                        ...finalMessages[recordingMessageIndex],
                        content: transcribedText,
                      };
                    }
                    return finalMessages;
                  });

                  if (transcribedText.trim()) {
                    setPendingAIRequest(true);
                  }

                  setRecordingStatus(`Complete: "${transcribedText}"`);
                  setTimeout(() => setRecordingStatus(""), 3000);
                  break;
                } else if (data.type === "error") {
                  setRecordingStatus("Transcription failed");
                  break;
                }
              } catch (parseError) {
                console.error("Error parsing transcription:", parseError);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error processing recording:", err);
        setRecordingStatus("Failed to transcribe audio");
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  const interruptAvatar = useCallback(async () => {
    if (avatarRef.current) {
      try {
        await fetch("/api/avatar/interrupt", {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch {
        // best-effort interrupt
      }
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    if (!isAIResponding && !isTranscribing) {
      interruptAvatar();
      startRecording();
    }
  }, [isAIResponding, isTranscribing, interruptAvatar, startRecording]);

  const handleMouseUp = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!isAIResponding && !isTranscribing) {
        interruptAvatar();
        startRecording();
      }
    },
    [isAIResponding, isTranscribing, interruptAvatar, startRecording]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (isRecording) {
        stopRecording();
      }
    },
    [isRecording, stopRecording]
  );

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
          <Button
            isIconOnly
            variant="light"
            onPress={() => router.push("/student-cases")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={pageTitle()}>Error</h1>
        </div>
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-default-500">
              {error || "Something went wrong"}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const isBusy = isAIResponding || isTranscribing;

  return (
    <div className="flex flex-col gap-3 max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <Button isIconOnly variant="light" onPress={handleBack} size="sm">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 shrink-0">
            <span className="text-sm font-bold text-primary-700">
              {caseAvatar.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {caseAvatar.name}
            </h1>
            <Chip size="sm" variant="flat" color="primary">
              {caseAvatar.role}
            </Chip>
          </div>
        </div>
        <Button
          variant="flat"
          size="sm"
          startContent={
            showTranscript ? (
              <MessageSquareOff className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )
          }
          onPress={() => setShowTranscript(!showTranscript)}
        >
          {showTranscript ? "Hide Transcript" : "Show Transcript"}
        </Button>
      </div>

      {/* Main content: Avatar left, Push-to-talk + Transcript right */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Live Avatar */}
        <div
          className={`flex flex-col gap-3 transition-all duration-300 ${showTranscript ? "w-3/5" : "w-full"}`}
        >
          <Card className="flex-1 overflow-hidden">
            <CardBody className="p-0 relative">
              {avatarConfig ? (
                <div className="w-full h-full min-h-[400px]">
                  <InteractiveAvatarWrapper
                    ref={avatarRef}
                    config={avatarConfig}
                    cleanMode={true}
                    autoStart={true}
                    showHistory={false}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[400px] bg-default-100">
                  <div className="text-center">
                    <UserIcon
                      className="mx-auto mb-2 text-default-400"
                      size={48}
                    />
                    <p className="text-default-500">
                      No avatar profile assigned
                    </p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Push-to-Talk controls below the avatar */}
          <Card className="shrink-0">
            <CardBody className="flex flex-row items-center justify-center gap-6 py-4">
              <Button
                className={`w-20 h-20 rounded-full transition-all duration-300 shadow-lg ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 scale-110 shadow-red-200"
                    : isBusy
                      ? "bg-gray-300 shadow-gray-200"
                      : "bg-primary hover:bg-primary-600 shadow-primary-200"
                }`}
                isIconOnly
                isDisabled={isBusy}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {isRecording ? (
                  <Spinner size="lg" color="white" variant="wave" />
                ) : isTranscribing ? (
                  <Spinner size="lg" color="white" variant="dots" />
                ) : isAIResponding ? (
                  <MicOff className="w-8 h-8 text-white opacity-50" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </Button>
              <div className="flex flex-col items-start gap-1">
                <p className="text-lg font-semibold text-default-800">
                  {isRecording
                    ? "Release to send"
                    : isBusy
                      ? "Please wait..."
                      : "Hold to talk"}
                </p>
                {recordingStatus && (
                  <Chip size="sm" variant="flat" color="default">
                    {recordingStatus}
                  </Chip>
                )}
                {isAIResponding && (
                  <Chip size="sm" variant="flat" color="warning">
                    <div className="flex items-center gap-1">
                      <Spinner size="sm" />
                      {caseAvatar.name} is thinking...
                    </div>
                  </Chip>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Transcript (optional) */}
        {showTranscript && (
          <div className="w-2/5 flex flex-col gap-3 transition-all duration-300">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="shrink-0 pb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Transcript</h3>
                  {chatMessages.length > 0 && (
                    <Chip size="sm" variant="flat" color="default">
                      {chatMessages.filter((m) => m.role === "user" && !m.content.includes("🎤") && !m.content.includes("📝")).length}{" "}
                      exchanges
                    </Chip>
                  )}
                </div>
              </CardHeader>
              <CardBody className="flex-1 overflow-hidden p-0">
                <ScrollShadow className="h-full px-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Mic className="w-10 h-10 mb-3 text-default-300" />
                      <p className="text-default-500 font-medium">
                        Ready to talk
                      </p>
                      <p className="text-sm text-default-400 mt-1 max-w-xs">
                        Hold the microphone button and speak to interview{" "}
                        {caseAvatar.name}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 py-3">
                      {chatMessages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-2 ${
                            message.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] p-3 rounded-xl text-sm ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-default-100"
                            }`}
                          >
                            {message.content === "🎤 Recording..." ? (
                              <div className="flex items-center gap-2">
                                <Spinner
                                  size="sm"
                                  color="current"
                                  variant="wave"
                                />
                                <span className="font-medium">
                                  Listening...
                                </span>
                              </div>
                            ) : message.content === "📝 Transcribing..." ? (
                              <div className="flex items-center gap-2">
                                <Spinner
                                  size="sm"
                                  color="current"
                                  variant="dots"
                                />
                                <span className="font-medium">
                                  Processing speech...
                                </span>
                              </div>
                            ) : message.role === "assistant" ? (
                              <div className="whitespace-pre-wrap leading-relaxed">
                                <MarkdownMessage content={message.content} />
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {message.content}
                              </p>
                            )}
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
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
