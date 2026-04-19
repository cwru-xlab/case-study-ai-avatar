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
  Type,
  Video,
  Mic,
  MicOff,
  RotateCcw,
  DoorOpen,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import { useLayout } from "@/lib/layout-context";
import AvatarImage from "@/components/AvatarImage";
import type { CaseStudy, CaseAvatar, InteractionLog, RoleMessage, RoleInteraction, InteractionEvent, StartAvatarRequest, VideoAudioProfile } from "@/types";
import InteractiveAvatarWrapper, { InteractiveAvatarRef } from "@/components/HeyGenAvatar/InteractiveAvatar";
import { HeygenSessionError } from "@/lib/heygen-client";
import { StreamingAvatarSessionState } from "@/components/HeyGenAvatar/logic";

type PageState = "intro" | "playing";
type InteractionMode = "text" | "avatar";
type SaveState = "idle" | "saving" | "saved" | "error";

interface InteractionIndexEntry {
  id: string;
  attemptNumber: number;
  mode: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  totalMessages: number;
  totalTimeSeconds: number;
  evalScore?: number;
  updatedAt: string;
}

export default function CasePlayPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { setFullScreen } = useLayout();
  const caseId = params.caseId as string;
  const cohortId = searchParams.get("cohortId") || "";

  const [caseData, setCaseData] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageState, setPageState] = useState<PageState>("intro");
  const [interactionLog, setInteractionLog] = useState<InteractionLog | null>(null);
  const [mode, setMode] = useState<"explore" | "assessed">("assessed");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Unfinished session state
  const [unfinishedSessions, setUnfinishedSessions] = useState<InteractionIndexEntry[]>([]);
  const [resuming, setResuming] = useState(false);

  // Role interaction state
  const [selectedRole, setSelectedRole] = useState<CaseAvatar | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, RoleMessage[]>>({});
  const [currentInput, setCurrentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [leavingCase, setLeavingCase] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const interactionLogRef = useRef<InteractionLog | null>(null);

  // Interaction mode state (text vs avatar)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("text");
  /** null = not loaded yet; mirrors GET /api/avatar/status */
  const [heygenAvatarConfigured, setHeygenAvatarConfigured] = useState<boolean | null>(null);
  const avatarRef = useRef<InteractiveAvatarRef>(null);
  const [avatarConfig, setAvatarConfig] = useState<StartAvatarRequest | null>(null);
  const [avatarConfigLoading, setAvatarConfigLoading] = useState(false);

  // HeyGen avatar time limit (per cohort case assignment)
  const [avatarTimeLimitSeconds, setAvatarTimeLimitSeconds] = useState<number | null>(null);
  const [avatarTotalSeconds, setAvatarTotalSeconds] = useState<number>(0); // never resets — accumulates all avatar time
  const [avatarLimitExhausted, setAvatarLimitExhausted] = useState(false);
  const [avatarGrandfathered, setAvatarGrandfathered] = useState(false); // true = current avatar session was running when limit hit, allow it to finish
  const avatarModeStartRef = useRef<number | null>(null);
  const avatarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const avatarTotalSecondsRef = useRef<number>(0);

  // Avatar portrait images (keyed by avatar id)
  const [avatarPortraits, setAvatarPortraits] = useState<Record<string, string>>({});

  // Finish confirmation modal
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Push-to-talk state for avatar mode
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Toggle full-screen mode when entering/leaving playing state
  useEffect(() => {
    setFullScreen(pageState === "playing");
    return () => setFullScreen(false);
  }, [pageState, setFullScreen]);

  // Align UI with server HeyGen config (same env as /api/avatar/get-access-token)
  useEffect(() => {
    if (pageState !== "playing") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/avatar/status");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setHeygenAvatarConfigured(Boolean(data.heygenConfigured));
      } catch {
        if (!cancelled) setHeygenAvatarConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageState]);

  // If server reports HeyGen unavailable, do not stay in avatar mode
  useEffect(() => {
    if (pageState !== "playing") return;
    if (heygenAvatarConfigured !== false) return;
    if (interactionMode !== "avatar") return;
    setInteractionMode("text");
  }, [pageState, heygenAvatarConfigured, interactionMode]);

  // Load case data
  useEffect(() => {
    loadCase();
  }, [caseId]);

  // Fetch avatar portrait images from their linked profiles
  useEffect(() => {
    if (!caseData?.avatars) return;
    const avatarsWithProfiles = caseData.avatars.filter((a) => a.profileId);
    if (avatarsWithProfiles.length === 0) return;

    Promise.all(
      avatarsWithProfiles.map(async (avatar) => {
        try {
          const res = await fetch(`/api/profile/get?id=${encodeURIComponent(avatar.profileId!)}`);
          if (!res.ok) return null;
          const data = await res.json();
          const portrait = data.profile?.portrait;
          if (portrait) return { id: avatar.id, portrait };
        } catch {}
        return null;
      })
    ).then((results) => {
      const portraits: Record<string, string> = {};
      for (const r of results) {
        if (r) portraits[r.id] = r.portrait;
      }
      setAvatarPortraits(portraits);
    });
  }, [caseData]);

  // Load unfinished sessions once we have user + caseId
  useEffect(() => {
    if (user?.email && caseId) {
      loadUnfinishedSessions();
    }
  }, [user?.email, caseId]);

  // Load avatar time limit from cohort
  useEffect(() => {
    if (!user?.email || !cohortId || !caseId) return;
    (async () => {
      try {
        const res = await fetch(`/api/cohort/get?id=${encodeURIComponent(cohortId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const cohort = data.cohort ?? data;
        const assignment = cohort.assignedCases?.find((a: { caseId: string }) => a.caseId === caseId);
        const limitMinutes: number | null = assignment?.heygenMinutesLimit ?? null;
        if (limitMinutes === null) return;
        const limitSeconds = limitMinutes * 60;
        setAvatarTimeLimitSeconds(limitSeconds);
        const timeRes = await fetch(
          `/api/interaction/avatar-time?studentEmail=${encodeURIComponent(user.email)}&caseId=${encodeURIComponent(caseId)}`
        );
        if (timeRes.ok) {
          const timeData = await timeRes.json();
          setAvatarTotalSeconds(timeData.usedSeconds ?? 0);
        }
      } catch {
        // non-critical — fail silently
      }
    })();
  }, [user?.email, cohortId, caseId]);

  const loadUnfinishedSessions = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(
        `/api/interaction/get?studentEmail=${encodeURIComponent(user.email)}&caseId=${encodeURIComponent(caseId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const inProgress = (data.logs || []).filter(
        (entry: InteractionIndexEntry) => entry.status === "in_progress"
      );
      setUnfinishedSessions(inProgress);
    } catch (err) {
      console.error("Failed to load unfinished sessions:", err);
    }
  };

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

  // Keep ref in sync so auto-save always has the latest log
  useEffect(() => {
    interactionLogRef.current = interactionLog;
  }, [interactionLog]);

  // Auto-save every 5 seconds for assessed mode
  useEffect(() => {
    if (pageState === "playing" && mode === "assessed") {
      autoSaveRef.current = setInterval(() => {
        if (interactionLogRef.current) {
          saveInteraction(interactionLogRef.current);
        }
      }, 5000);

      return () => {
        if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      };
    }
  }, [pageState, mode]);

  // Keep avatarTotalSecondsRef in sync with state
  useEffect(() => {
    avatarTotalSecondsRef.current = avatarTotalSeconds;
  }, [avatarTotalSeconds]);

  // Cleanup avatar timer on unmount
  useEffect(() => {
    return () => {
      if (avatarTimerRef.current) clearInterval(avatarTimerRef.current);
    };
  }, []);

  // Save interaction on page unload (tab close / navigate away)
  useEffect(() => {
    const handleUnload = () => {
      const log = interactionLogRef.current;
      if (log && log.mode === "assessed") {
        navigator.sendBeacon(
          "/api/interaction/save",
          new Blob([JSON.stringify({ log })], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Watch for limit exhaustion — set flag without interrupting current session
  useEffect(() => {
    if (avatarTimeLimitSeconds !== null && avatarTotalSeconds >= avatarTimeLimitSeconds && !avatarLimitExhausted) {
      setAvatarLimitExhausted(true);
      // If currently in an active avatar session, let it finish
      if (interactionMode === "avatar") {
        setAvatarGrandfathered(true);
      }
    }
  }, [avatarTotalSeconds, avatarTimeLimitSeconds, avatarLimitExhausted, interactionMode]);

  // Load avatar profile config when role changes or when switching to avatar mode
  useEffect(() => {
    if (interactionMode === "avatar" && selectedRole?.profileId) {
      loadAvatarConfig(selectedRole.profileId);
    }
  }, [interactionMode, selectedRole]);

  const loadAvatarConfig = async (profileId: string) => {
    setAvatarConfigLoading(true);
    try {
      const res = await fetch(`/api/profile/get?id=${encodeURIComponent(profileId)}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      const profile: VideoAudioProfile = data.profile;
      setAvatarConfig({
        quality: profile.quality,
        avatarName: profile.avatarName,
        knowledgeId: profile.knowledgeId,
        voice: profile.voice,
        language: profile.language,
      });
    } catch (err) {
      console.error("Failed to load avatar profile:", err);
      addToast({ title: "Failed to load avatar profile, using defaults", color: "warning" });
      setAvatarConfig(null);
    } finally {
      setAvatarConfigLoading(false);
    }
  };

  const saveInteraction = async (log: InteractionLog) => {
    if (log.mode !== "assessed") return;
    setSaveState("saving");
    try {
      await fetch("/api/interaction/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log }),
      });
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error("Auto-save failed:", err);
      setSaveState("error");
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

  const handleResume = async (session: InteractionIndexEntry) => {
    if (!user?.email || !caseData) return;

    setResuming(true);
    try {
      const res = await fetch(
        `/api/interaction/get?studentEmail=${encodeURIComponent(user.email)}&caseId=${encodeURIComponent(caseId)}&logId=${encodeURIComponent(session.id)}`
      );
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      const log: InteractionLog = data.log;

      // Restore chat messages from the interaction log (deep copy to avoid shared references)
      const restoredMessages: Record<string, RoleMessage[]> = {};
      for (const [roleId, roleInteraction] of Object.entries(log.roleInteractions) as [string, RoleInteraction][]) {
        if (roleInteraction.messages.length > 0) {
          restoredMessages[roleId] = [...roleInteraction.messages];
        }
      }

      // Add a resume event
      log.events.push({
        type: "start_session",
        timestamp: Date.now(),
      });
      log.updatedAt = new Date().toISOString();

      setMode(log.mode as "explore" | "assessed");
      setInteractionLog(log);
      setChatMessages(restoredMessages);
      setPageState("playing");

      // Immediately save so the resume event is persisted
      if (log.mode === "assessed") {
        saveInteraction(log);
      }

      addToast({ title: "Session resumed", color: "success" });
    } catch (err) {
      console.error("Failed to resume session:", err);
      addToast({ title: "Failed to resume session", color: "danger" });
    } finally {
      setResuming(false);
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

      // Stop avatar session when switching roles
      if (interactionMode === "avatar") {
        stopAvatarTimer();
        avatarRef.current?.stopSession();
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

    // Force text mode when switching to a new role if avatar limit is exhausted
    if (avatarLimitExhausted && interactionMode === "avatar") {
      setAvatarGrandfathered(false);
      setInteractionMode("text");
    }
  };

  const stopAvatarTimer = () => {
    if (avatarTimerRef.current) {
      clearInterval(avatarTimerRef.current);
      avatarTimerRef.current = null;
    }
    avatarModeStartRef.current = null;
    // avatarTotalSeconds is NOT reset — it keeps accumulating across sessions
  };

  const startAvatarTimer = useCallback(() => {
    if (avatarTimerRef.current) return;
    avatarModeStartRef.current = Date.now();
    const baseTotal = avatarTotalSecondsRef.current;
    avatarTimerRef.current = setInterval(() => {
      if (avatarModeStartRef.current !== null) {
        setAvatarTotalSeconds(baseTotal + Math.round((Date.now() - avatarModeStartRef.current) / 1000));
      }
    }, 1000);
  }, []);

  const handleAvatarSessionStateChange = useCallback((state: StreamingAvatarSessionState) => {
    if (state === StreamingAvatarSessionState.CONNECTED) {
      startAvatarTimer();
    } else {
      stopAvatarTimer();
    }
  }, [startAvatarTimer]);

  const handleAvatarTokenError = useCallback((err: HeygenSessionError) => {
    if (err.code === "HEYGEN_MISSING_KEY" || err.code === "HEYGEN_INVALID_KEY") {
      setHeygenAvatarConfigured(false);
      setInteractionMode("text");
      addToast({
        title: "Switched to text chat",
        description: err.message,
        color: "warning",
      });
    }
  }, []);

  const handleSwitchInteractionMode = (newMode: InteractionMode) => {
    if (newMode === interactionMode) return;
    if (!interactionLog || !selectedRole) return;

    // Block switching to avatar if limit is exhausted
    if (newMode === "avatar" && avatarLimitExhausted) return;

    if (newMode === "avatar" && heygenAvatarConfigured === false) {
      addToast({
        title: "Avatar unavailable",
        description:
          "HeyGen is not configured or the API key is invalid. Use text chat or ask your instructor to set HEYGEN_API_KEY.",
        color: "warning",
      });
      return;
    }

    const now = Date.now();

    // Log the mode switch event
    const switchEvent: InteractionEvent = {
      type: "switch_interaction_mode",
      roleId: selectedRole.id,
      roleName: selectedRole.name,
      timestamp: now,
      interactionMode: newMode,
    };
    interactionLog.events.push(switchEvent);
    setInteractionLog({ ...interactionLog });

    if (newMode === "avatar") {
      // Timer will start when the avatar session reports CONNECTED
    } else if (interactionMode === "avatar") {
      // Pause timer — total already includes this session's time via setInterval
      stopAvatarTimer();
      avatarRef.current?.stopSession();
      setAvatarGrandfathered(false);
    }

    setInteractionMode(newMode);
  };

  // Shared function to send a message and get AI response (used by both text and voice input)
  const sendMessageAndGetResponse = async (userMessage: string) => {
    if (!selectedRole || !interactionLog || !caseData) return;

    setSending(true);

    const now = Date.now();
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

      // If in avatar mode, have the avatar speak the response
      if (interactionMode === "avatar") {
        avatarRef.current?.speak(data.message);
      }

      return data.message;
    } catch (err) {
      console.error("Chat error:", err);
      addToast({ title: "Failed to get response", color: "danger" });
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;
    const userMessage = currentInput.trim();
    setCurrentInput("");
    await sendMessageAndGetResponse(userMessage);
  };

  // Push-to-talk handlers for avatar mode
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        processRecording();
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      addToast({ title: "Could not access microphone", color: "danger" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async () => {
    if (audioChunksRef.current.length === 0) return;

    setIsTranscribing(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Transcription failed");

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
              if (data.type === "delta") {
                transcribedText = data.text;
              } else if (data.type === "done") {
                transcribedText = data.text;
                break;
              } else if (data.type === "error") {
                throw new Error("Transcription error");
              }
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message === "Transcription error") {
                throw parseError;
              }
              console.error("Error parsing transcription:", parseError);
            }
          }
        }
      }

      if (transcribedText.trim()) {
        await sendMessageAndGetResponse(transcribedText.trim());
      }
    } catch (error) {
      console.error("Error processing recording:", error);
      addToast({ title: "Failed to transcribe audio", color: "danger" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handlePushToTalkDown = () => {
    if (!sending && !isTranscribing) {
      avatarRef.current?.interrupt();
      startRecording();
    }
  };

  const handlePushToTalkUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  const handleFinish = async () => {
    if (!interactionLog) return;

    setFinishing(true);
    try {
      // Clear auto-save
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);

      // Stop avatar session if active
      if (interactionMode === "avatar") {
        stopAvatarTimer();
        avatarRef.current?.stopSession();
      }

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

  /** Leave the case without submitting; progress stays in_progress on server (assessed). */
  const handleSaveAndExit = async () => {
    setLeavingCase(true);
    try {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
      if (interactionMode === "avatar") {
        stopAvatarTimer();
        avatarRef.current?.stopSession();
        setAvatarGrandfathered(false);
      }
      const log = interactionLogRef.current;
      if (log?.mode === "assessed") {
        await saveInteraction(log);
      }
      addToast({
        title: "Progress saved",
        description:
          mode === "assessed"
            ? "Continue later from My Cases. Nothing was submitted for grading."
            : "You can open this case again when you are ready.",
        color: "success",
      });
      const q = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : "";
      router.push(`/student-cases${q}`);
    } catch (err) {
      console.error("Save and exit failed:", err);
      addToast({
        title: "Could not save before leaving",
        description: "Check your connection and try again.",
        color: "danger",
      });
    } finally {
      setLeavingCase(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Check if current role has a profile configured for avatar mode
  const roleHasAvatarProfile = selectedRole?.profileId != null;

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
                  <div key={avatar.id} className="flex items-center gap-4 p-4 bg-default-50 rounded-lg">
                    <AvatarImage
                      portrait={avatarPortraits[avatar.id]}
                      name={avatar.name}
                      size={48}
                      className="shrink-0"
                    />
                    <div>
                      <p className="font-semibold">{avatar.name}</p>
                      <p className="text-sm text-default-500">{avatar.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {unfinishedSessions.length > 0 && (
          <Card className="border-2 border-warning/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-warning" />
                <h2 className="text-xl font-semibold">Unfinished Sessions</h2>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-default-500 mb-4">
                You have sessions in progress. You can continue where you left off.
              </p>
              <p className="text-xs text-default-400 mb-4">
                Sessions appear here automatically when you close the page before finishing.
              </p>
              <div className="grid gap-3">
                {unfinishedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 bg-warning-50 dark:bg-warning-50/10 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={session.mode === "assessed" ? "primary" : "default"}
                        >
                          {session.mode === "assessed" ? `Attempt #${session.attemptNumber}` : "Explore"}
                        </Chip>
                        <span className="text-xs text-default-400">
                          {session.totalMessages} messages
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-default-400" />
                        <span className="text-xs text-default-500">
                          Started {new Date(session.startedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      color="warning"
                      variant="flat"
                      startContent={<RotateCcw className="w-4 h-4" />}
                      onPress={() => handleResume(session)}
                      isLoading={resuming}
                    >
                      Continue
                    </Button>
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
    <div className="flex h-full gap-4 p-4">
      {/* Left sidebar - Roles */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Roles</h3>
          <Chip size="sm" variant="flat" color={mode === "assessed" ? "primary" : "default"}>
            {mode === "assessed" ? "Assessed" : "Explore"}
          </Chip>
        </div>
        {mode === "assessed" && (
          <p className="text-xs text-default-500">
            Progress auto-saves every 5s. You can close this page and continue later.
          </p>
        )}
        {mode === "assessed" && (
          <p className={`text-xs ${saveState === "error" ? "text-danger-500" : "text-default-400"}`}>
            {saveState === "saving" && "Saving..."}
            {saveState === "saved" && `Saved at ${lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : "just now"}`}
            {saveState === "error" && "Auto-save failed. We will retry shortly."}
            {saveState === "idle" && "Autosave is ready."}
          </p>
        )}
        {heygenAvatarConfigured === false && (
          <p className="text-xs text-warning-700 dark:text-warning-600">
            Avatar mode is unavailable (HeyGen API key missing or invalid on the server). Text chat still works.
          </p>
        )}

        <div className="flex flex-col gap-2 flex-1 overflow-y-auto px-1 -mx-1">
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
                  <div className="flex items-center gap-3">
                    <AvatarImage
                      portrait={avatarPortraits[avatar.id]}
                      name={avatar.name}
                      size={32}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{avatar.name}</p>
                      <p className="text-xs text-default-500 line-clamp-1">{avatar.role}</p>
                      {msgCount > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <MessageSquare className="w-3 h-3 text-default-400" />
                          <span className="text-xs text-default-400">{msgCount} messages</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 w-full shrink-0">
          <Button
            variant="bordered"
            color="default"
            startContent={<DoorOpen className="w-4 h-4" />}
            onPress={handleSaveAndExit}
            isLoading={leavingCase}
            isDisabled={finishing}
            className="w-full"
          >
            Save &amp; exit
          </Button>
          <p className="text-[11px] text-center text-default-400 leading-snug px-0.5">
            Returns to My Cases without submitting. Your attempt stays in progress.
          </p>
          <Button
            color="danger"
            variant="flat"
            startContent={<CheckCircle className="w-4 h-4" />}
            onPress={() => setShowFinishModal(true)}
            isLoading={finishing}
            isDisabled={leavingCase}
            className="w-full"
          >
            I&apos;m Finished
          </Button>
        </div>
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
        ) : interactionMode === "avatar" && avatarLimitExhausted && !avatarGrandfathered ? (
          /* ── Avatar limit exhausted screen ── */
          <div className="flex-1 flex items-center justify-center bg-default-50">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
                <Video className="w-8 h-8 text-danger-500" />
              </div>
              <h3 className="text-xl font-semibold text-default-800 mb-2">Avatar Time Used Up</h3>
              <p className="text-default-500 mb-6">
                You have used all {avatarTimeLimitSeconds !== null ? avatarTimeLimitSeconds / 60 : 0} minutes of avatar interaction for this case. You can continue the case study using text chat.
              </p>
              <Button
                color="primary"
                onPress={() => setInteractionMode("text")}
                startContent={<Type className="w-4 h-4" />}
              >
                Continue with Text
              </Button>
            </div>
          </div>
        ) : interactionMode === "avatar" ? (
          /* ── Immersive avatar mode: video fills the area, UI floats on top ── */
          <div className="relative flex-1 bg-black overflow-hidden">
            {/* Background video layer */}
            {avatarConfigLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size="lg" label="Loading avatar..." className="text-white" />
              </div>
            ) : (
              <div className="absolute inset-0">
                <InteractiveAvatarWrapper
                  ref={avatarRef}
                  config={avatarConfig ?? undefined}
                  showHistory={false}
                  autoStart={true}
                  cleanMode={true}
                  onSessionStateChange={handleAvatarSessionStateChange}
                  onSessionTokenError={handleAvatarTokenError}
                />
              </div>
            )}

            {/* Floating header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
              <div>
                <p className="font-semibold text-white">{selectedRole.name}</p>
                <p className="text-sm text-white/70">{selectedRole.role}</p>
              </div>
              <div className="flex items-center gap-2">
                {roleHasAvatarProfile && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-white/10 text-white/70"
                        onPress={() => handleSwitchInteractionMode("text")}
                        startContent={<Type className="w-3 h-3" />}
                      >
                        Text
                      </Button>
                      {(() => {
                        const limitExhausted = avatarLimitExhausted;
                        const avatarUnavailable = heygenAvatarConfigured !== true;
                        return (
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-white/20 text-white"
                            onPress={() => handleSwitchInteractionMode("avatar")}
                            startContent={<Video className="w-3 h-3" />}
                            isDisabled={limitExhausted || avatarUnavailable}
                          >
                            Avatar
                          </Button>
                        );
                      })()}
                    </div>
                    {avatarTimeLimitSeconds !== null && (
                      <span className={`text-xs font-medium ${avatarLimitExhausted ? "text-danger-400" : "text-white/60"}`}>
                        {avatarLimitExhausted
                          ? "Limit reached"
                          : (() => {
                              const remaining = avatarTimeLimitSeconds - avatarTotalSeconds;
                              return remaining < 60
                                ? `${remaining}s left`
                                : `${Math.floor(remaining / 60)}m left`;
                            })()
                        }
                      </span>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-white/10 text-white/70 hover:bg-white/20"
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
                    stopAvatarTimer();
                    avatarRef.current?.stopSession();
                    setAvatarGrandfathered(false);
                    setSelectedRole(null);
                  }}
                >
                  Back to Roles
                </Button>
              </div>
            </div>

            {/* Floating input area */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex flex-col items-center gap-2">
                <Button
                  size="lg"
                  color={isRecording ? "danger" : "primary"}
                  className={`rounded-full w-14 h-14 transition-all shadow-lg ${isRecording ? "scale-110" : ""}`}
                  isIconOnly
                  isDisabled={sending || isTranscribing}
                  onMouseDown={handlePushToTalkDown}
                  onMouseUp={handlePushToTalkUp}
                  onMouseLeave={handlePushToTalkUp}
                  onTouchStart={(e: React.TouchEvent) => { e.preventDefault(); handlePushToTalkDown(); }}
                  onTouchEnd={(e: React.TouchEvent) => { e.preventDefault(); handlePushToTalkUp(); }}
                >
                  {isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : isTranscribing ? (
                    <Spinner size="sm" color="white" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
                <p className="text-xs text-white/60">
                  {isRecording
                    ? "Release to send"
                    : isTranscribing
                      ? "Transcribing..."
                      : sending
                        ? "Getting response..."
                        : "Hold to talk"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Standard text mode layout ── */
          <>
            {/* Chat header */}
            <div className="p-4 border-b bg-default-50 flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedRole.name}</p>
                <p className="text-sm text-default-500">{selectedRole.role}</p>
              </div>
              <div className="flex items-center gap-2">
                {roleHasAvatarProfile && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onPress={() => handleSwitchInteractionMode("text")}
                        startContent={<Type className="w-3 h-3" />}
                      >
                        Text
                      </Button>
                      {(() => {
                        const limitExhausted = avatarLimitExhausted;
                        const avatarUnavailable = heygenAvatarConfigured !== true;
                        return (
                          <Button
                            size="sm"
                            variant="flat"
                            color="default"
                            onPress={() => handleSwitchInteractionMode("avatar")}
                            startContent={<Video className="w-3 h-3" />}
                            isDisabled={limitExhausted || avatarUnavailable}
                          >
                            Avatar
                          </Button>
                        );
                      })()}
                    </div>
                    {avatarTimeLimitSeconds !== null && (
                      <span className={`text-xs font-medium ${avatarLimitExhausted ? "text-danger-500" : "text-default-400"}`}>
                        {avatarLimitExhausted
                          ? "Limit reached"
                          : (() => {
                              const remaining = avatarTimeLimitSeconds - avatarTotalSeconds;
                              return remaining < 60
                                ? `${remaining}s left`
                                : `${Math.floor(remaining / 60)}m left`;
                            })()
                        }
                      </span>
                    )}
                  </div>
                )}
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
                  Back to Roles
                </Button>
              </div>
            </div>

            {/* Messages */}
            {avatarLimitExhausted && roleHasAvatarProfile && (
              <div className="p-4 border-b bg-warning-50 flex items-start gap-3">
                <Video className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-warning-800 text-sm">Avatar time limit reached</p>
                  <p className="text-xs text-warning-700 mt-0.5">
                    You have used all {avatarTimeLimitSeconds !== null ? avatarTimeLimitSeconds / 60 : 0} minutes of avatar interaction for this case. You can continue with text mode.
                  </p>
                </div>
              </div>
            )}
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

            {/* Text input */}
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

      {/* Finish confirmation modal */}
      <Modal isOpen={showFinishModal} onClose={() => setShowFinishModal(false)} size="sm">
        <ModalContent>
          <ModalHeader>End This Session?</ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you&apos;re finished with the entire case? Submitting now ends this attempt and it will no longer appear under Unfinished Sessions.
            </p>
            <p className="text-default-600">
              You won&apos;t be able to continue this conversation or make any changes after submission.
              {mode === "assessed" && (
                <span className="block mt-2 font-medium text-warning-600">
                  This is an assessed attempt. Submission will trigger evaluation.
                </span>
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setShowFinishModal(false)}>
              Keep Going
            </Button>
            <Button
              color="danger"
              onPress={() => {
                setShowFinishModal(false);
                handleFinish();
              }}
              isLoading={finishing}
            >
              Yes, I&apos;m Finished
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
