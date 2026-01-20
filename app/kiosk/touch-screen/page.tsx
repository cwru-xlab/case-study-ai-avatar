/**
 * KIOSK TOUCH-SCREEN COMPONENT - CHAT STORAGE INTEGRATION
 *
 * This component implements the primary user interface for the AI Avatar Kiosk
 * and serves as the main integration point for the chat storage system.
 *
 * Core Requirements Implemented:
 * 1. Automatically serialize chat sessions when users exit
 * 2. Store chat IDs in IndexedDB for quick lookup
 * 3. Save chat sessions as JSON files in S3
 *
 * Chat Storage Integration Points:
 * - Session start when first message is sent
 * - Message addition for each user/assistant interaction
 * - Session end on navigation, avatar switching, or page exit
 * - Automatic session recovery for browser crashes
 *
 * Component Architecture:
 * - State management for current session tracking
 * - Event handlers for session lifecycle management
 * - Integration with existing localStorage sync for dual-screen setup
 * - Error handling and recovery mechanisms
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Progress } from "@heroui/progress";
import AvatarImage from "@/components/AvatarImage";
import {
  Mic,
  MicOff,
  Zap,
  MessageSquare,
  MessageSquareOff,
  OctagonX,
  RefreshCcw,
} from "lucide-react";

import { avatarStorage, type CachedAvatar } from "@/lib/avatar-storage";
import {
  AnimatedBackground,
  WeatherheadLogo,
  XLabLogo,
  QRCodeDisplay,
} from "@/components/kiosk";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { chatStorage } from "@/lib/chat-storage";
import { type ConversationStarter, type ChatMessage } from "@/types";

type KioskState = "grid" | "selected" | "chatting";

export default function TouchScreen() {
  const [avatars, setAvatars] = useState<CachedAvatar[]>([]);
  const [state, setState] = useState<KioskState>("grid");
  const [selectedAvatar, setSelectedAvatar] = useState<CachedAvatar | null>(
    null
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  /**
   * CHAT SESSION TRACKING STATE
   *
   * NEW: Added for chat storage implementation
   * Tracks the current active session ID to enable proper session management.
   *
   * This state is critical for:
   * - Linking messages to the correct session
   * - Ending sessions when users navigate away
   * - Session recovery after crashes
   * - Preventing session ID conflicts
   */
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>("");
  const [showChatHistory, setShowChatHistory] = useState(false);

  // Avatar loading states (synced from main display)
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Timeout warning state
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Timeout management for auto-return to grid
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const TIMEOUT_DURATION = 60 * 1000; // 1 minute in milliseconds
  const WARNING_DURATION = 45 * 1000; // 45 seconds for warning

  /**
   * RESET TIMEOUT FUNCTION
   *
   * Clears current timeouts and starts new warning and main timers.
   * Called whenever user interacts with any button on the touch screen.
   */
  const resetTimeout = () => {
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Hide warning if it's currently shown
    setShowTimeoutWarning(false);

    // Only set timeout if we're not on the grid (to avoid timeout on main page)
    if (state !== "grid") {
      // Set warning timeout (45 seconds)
      warningTimeoutRef.current = setTimeout(() => {
        console.log("⚠️ WARNING: Showing timeout warning at 45 seconds");
        setShowTimeoutWarning(true);
      }, WARNING_DURATION);

      // Set main timeout (60 seconds)
      timeoutRef.current = setTimeout(() => {
        console.log(
          "⏰ TIMEOUT: Auto-navigating back to avatar grid after 1 minute of inactivity"
        );
        handleBack("grid");
      }, TIMEOUT_DURATION);
    }
  };

  // Disable right-click for safety in kiosk mode
  useEffect(() => {
    const disableRightClick = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", disableRightClick);

    return () => {
      document.removeEventListener("contextmenu", disableRightClick);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      const all = await avatarStorage.list();
      const published = all.filter((a) => a.published);
      setAvatars(published);
      
      // Store all published avatars in localStorage for VideoCarousel to use
      localStorage.setItem("kioskPublishedAvatars", JSON.stringify(published));
    };

    // Clean start - reset all kiosk state when component mounts
    localStorage.removeItem("kioskSelectedAvatar");
    localStorage.removeItem("kioskChatMessages");
    localStorage.removeItem("kioskStreamingContent");
    localStorage.removeItem("kioskShowChat");
    localStorage.removeItem("kioskAIResponseToSpeak");
    localStorage.removeItem("kioskIsAIResponding");
    localStorage.setItem("kioskState", "grid");
    setShowChatHistory(false);
    // Notify main display of state change
    window.dispatchEvent(new Event("storage"));

    load();
  }, []);

  // Listen for avatar loading state changes from main display
  useEffect(() => {
    const handleStorageChange = () => {
      const isLoading = localStorage.getItem("kioskAvatarLoading") === "true";
      const progress = parseFloat(
        localStorage.getItem("kioskLoadingProgress") || "0"
      );
      const message = localStorage.getItem("kioskLoadingMessage") || "";

      setAvatarLoading(isLoading);
      setLoadingProgress(progress);
      setLoadingMessage(message);
    };

    // Listen for storage changes
    window.addEventListener("storage", handleStorageChange);

    // Check initial state
    handleStorageChange();

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  /**
   * PAGE EXIT DETECTION AND SESSION SAVING
   *
   * NEW: Critical implementation of the requirement to save when users exit.
   *
   * This effect implements multiple layers of exit detection:
   * 1. beforeunload event - Browser tab close, page refresh, navigation away
   * 2. Component unmount - React component cleanup
   * 3. Dependency tracking - Automatic cleanup when session changes
   *
   * Implementation:
   * - Detects when user exits the chat interface
   * - Automatically triggers session serialization to S3
   * - Ensures no chat data is lost due to unexpected exits
   * - Provides redundant safety mechanisms
   *
   * Technical Implementation:
   * - beforeunload has timing constraints, so this is best-effort
   * - Component unmount provides more reliable async operation
   * - Dependency array ensures cleanup when session ID changes
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSessionId) {
        // Save session on page exit - implements automatic session saving
        chatStorage.endSession(currentSessionId);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Also end session on component unmount - more reliable than beforeunload
      if (currentSessionId) {
        chatStorage.endSession(currentSessionId);
      }
    };
  }, [currentSessionId]);

  /**
   * TIMEOUT MANAGEMENT EFFECT
   *
   * Sets up and manages the warning and main inactivity timeouts.
   * Starts timeouts when entering selected or chatting states.
   * Cleans up timeouts when leaving those states or component unmounts.
   */
  useEffect(() => {
    // Start timeout when entering non-grid states
    if (state === "selected" || state === "chatting") {
      resetTimeout();
    } else {
      // Clear timeouts when on grid
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      // Hide warning when on grid
      setShowTimeoutWarning(false);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [state]);

  /**
   * DISMISS TIMEOUT WARNING
   *
   * Called when user touches the warning overlay.
   * Hides the warning and resets both timeouts.
   */
  const dismissTimeoutWarning = () => {
    console.log(
      "👆 USER INTERACTION: Dismissing timeout warning and resetting timers"
    );
    resetTimeout();
  };

  /**
   * START NEW CHAT SESSION
   *
   * NEW: Implements the beginning of the chat storage lifecycle.
   * Called when user starts chatting with an avatar.
   *
   * Integration Features:
   * - Creates unique session ID for S3 storage
   * - Sets up session metadata for analytics
   * - Marks session as kiosk mode interaction
   * - Includes location tracking for multi-kiosk deployments
   *
   * Error Handling:
   * - Graceful failure if session creation fails
   * - Logging for debugging issues
   * - Chat continues even if session tracking fails
   */
  const startChatSession = (avatar: CachedAvatar) => {
    try {
      console.log(
        "🟡 DEBUG: Starting chat session for avatar:",
        avatar.id,
        avatar.name
      );

      const sessionId = chatStorage.startSession(avatar.id, avatar.name, {
        isKioskMode: true, // Identifies kiosk vs preview interactions
        location: "kiosk-touch-screen", // Future support for multiple kiosk locations
      });
      setCurrentSessionId(sessionId);
      console.log("✅ SUCCESS: Started chat session:", sessionId);
    } catch (error) {
      console.error("❌ ERROR: Failed to start chat session:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : String(error)
      );

      // Set a fallback session ID so the interface still works
      const fallbackSessionId = `fallback-${Date.now()}`;
      setCurrentSessionId(fallbackSessionId);
      console.log("🔄 FALLBACK: Using fallback session ID:", fallbackSessionId);
    }
  };

  /**
   * ADD MESSAGE TO ACTIVE SESSION
   *
   * NEW: Integrates message tracking with the chat storage system.
   * Called for every user input and AI response.
   *
   * Features:
   * - Tracks both user and assistant messages
   * - Maintains chronological order with timestamps
   * - Caches messages locally for crash recovery
   * - Non-blocking operation (chat continues if storage fails)
   *
   * Integration with Existing Code:
   * - Does not disrupt existing localStorage synchronization
   * - Maintains compatibility with dual-screen kiosk setup
   * - Preserves existing error handling patterns
   */
  const addMessageToSession = async (message: ChatMessage) => {
    try {
      console.log(
        "🟡 DEBUG: Adding message to session:",
        currentSessionId,
        message.role,
        message.content.substring(0, 50) + "..."
      );
      await chatStorage.addMessage(message);
      console.log("✅ SUCCESS: Message added to session");
    } catch (error) {
      console.error("❌ ERROR: Failed to add message to session:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  /**
   * END CURRENT SESSION
   *
   * NEW: Implements the core requirement to serialize chat sessions.
   * Called when user navigates away, switches avatars, or exits.
   *
   * Process:
   * 1. Validates session exists and has content
   * 2. Creates complete ChatSession object with metadata
   * 3. Saves to S3 as JSON file under /chats/ prefix
   * 4. Caches metadata in IndexedDB for quick lookup
   * 5. Cleans up local state and temporary data
   *
   * Error Handling:
   * - Graceful handling if S3 save fails
   * - Local caching as backup for retry
   * - Cleanup happens regardless of save success
   * - Detailed logging for debugging
   */
  const endCurrentSession = async () => {
    if (currentSessionId) {
      try {
        await chatStorage.endSession(currentSessionId);
        setCurrentSessionId(null);
        console.log("Ended chat session:", currentSessionId);
      } catch (error) {
        console.error("Failed to end chat session:", error);
      }
    }
  };

  // Sync chat messages with main display
  const updateMainDisplay = (
    messages: ChatMessage[],
    avatar: CachedAvatar | null
  ) => {
    localStorage.setItem("kioskChatMessages", JSON.stringify(messages));
    localStorage.setItem("kioskSelectedAvatar", JSON.stringify(avatar));
    // Notify main display of state change
    window.dispatchEvent(new Event("storage"));
  };

  const handleAvatarSelect = async (avatar: CachedAvatar) => {
    console.log("Touch screen: Avatar selected, setting state to 'selected'");

    // Reset timeout on user interaction
    resetTimeout();

    // End current session if switching avatars
    if (currentSessionId) {
      await endCurrentSession();
    }

    // Clear any existing chat when selecting a new avatar
    setChatMessages([]);
    setSelectedAvatar(avatar);
    setState("selected");

    // Update main display with selected avatar and sync state
    localStorage.setItem("kioskSelectedAvatar", JSON.stringify(avatar));
    localStorage.removeItem("kioskChatMessages");
    localStorage.removeItem("kioskStreamingContent");
    localStorage.setItem("kioskState", "selected");

    console.log(
      "Touch screen: Dispatching storage event for state:",
      "selected"
    );
    window.dispatchEvent(new Event("storage"));
  };

  const handleStarterSelect = async (starter: ConversationStarter) => {
    if (!selectedAvatar) return;

    // Reset timeout on user interaction
    resetTimeout();

    const userMessage: ChatMessage = {
      role: "user",
      content: starter.question,
      timestamp: Date.now(),
    };

    // Start session if this is the first message
    if (!currentSessionId) {
      startChatSession(selectedAvatar);
    }

    setState("chatting");

    // Add user message to session
    addMessageToSession(userMessage);

    // Check if opening remarks are provided for instant response
    if (starter.openingRemarks) {
      // Use opening remarks for instant response (no AI call needed)
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: starter.openingRemarks,
        timestamp: Date.now(),
      };

      const messagesWithRemarks = [userMessage, assistantMessage];
      setChatMessages(messagesWithRemarks);

      // Add assistant message to session
      addMessageToSession(assistantMessage);

      // Update main display and sync state
      updateMainDisplay(messagesWithRemarks, selectedAvatar);
      localStorage.setItem("kioskState", "chatting");

      // Trigger avatar to speak the opening remarks directly
      localStorage.setItem("kioskAIResponseToSpeak", starter.openingRemarks);
      window.dispatchEvent(new Event("storage"));
    } else {
      // No opening remarks - use standard AI flow
      const newMessages = [userMessage];
      setChatMessages(newMessages);
      setIsAIResponding(true);

      // Sync AI responding state to localStorage for main display
      localStorage.setItem("kioskIsAIResponding", "true");
      window.dispatchEvent(new Event("storage"));

      // Update main display immediately and sync state
      updateMainDisplay(newMessages, selectedAvatar);
      localStorage.setItem("kioskState", "chatting");

      // Send to AI
      await sendToAI(newMessages, selectedAvatar);
    }
  };

  const sendToAI = async (messages: ChatMessage[], avatar: CachedAvatar) => {
    try {
      setIsAIResponding(true);

      // Sync AI responding state to localStorage for main display
      localStorage.setItem("kioskIsAIResponding", "true");
      window.dispatchEvent(new Event("storage"));

      const response = await fetch("/api/llm/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          avatarId: avatar.id,
          systemPrompt: avatar.systemPrompt,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader available");

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
              if (data.type === "content") {
                assistantContent = data.content;
                // Update streaming content on main display
                localStorage.setItem("kioskStreamingContent", assistantContent);
                window.dispatchEvent(new Event("storage"));
              } else if (data.type === "end") {
                const assistantMessage: ChatMessage = {
                  role: "assistant",
                  content: assistantContent,
                  timestamp: Date.now(),
                };
                const updatedMessages = [...messages, assistantMessage];
                setChatMessages(updatedMessages);
                updateMainDisplay(updatedMessages, avatar);
                // Add assistant message to chat storage
                addMessageToSession(assistantMessage);
                localStorage.removeItem("kioskStreamingContent");

                // Trigger avatar to speak the response
                localStorage.setItem(
                  "kioskAIResponseToSpeak",
                  assistantContent
                );

                window.dispatchEvent(new Event("storage"));
                break;
              }
            } catch (parseError) {
              console.error("Error parsing AI response:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("AI response error:", error);
    } finally {
      // Always reset the AI responding state
      setIsAIResponding(false);

      // Sync AI responding state to localStorage for main display
      localStorage.setItem("kioskIsAIResponding", "false");
      window.dispatchEvent(new Event("storage"));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Create the recording message
      const recordingMessage: ChatMessage = {
        role: "user",
        content: "🎤 Recording...",
        timestamp: Date.now(),
      };
      const newMessages = [...chatMessages, recordingMessage];
      const recordingMessageIndex = newMessages.length - 1;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        processRecording(newMessages, recordingMessageIndex);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus("Recording...");

      // Update state and display
      setChatMessages(newMessages);
      updateMainDisplay(newMessages, selectedAvatar);
    } catch (error) {
      console.error("Error starting recording:", error);
      setRecordingStatus("Error accessing microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (
    messagesWithRecording: ChatMessage[],
    recordingMessageIndex: number
  ) => {
    if (audioChunksRef.current.length === 0) return;

    setIsTranscribing(true);
    setRecordingStatus("Transcribing...");

    console.log("messagesWithRecording", messagesWithRecording);
    console.log("recordingMessageIndex", recordingMessageIndex);

    // Update to transcribing state
    const currentMessages = [...messagesWithRecording];
    currentMessages[recordingMessageIndex] = {
      ...currentMessages[recordingMessageIndex],
      content: "📝 Transcribing...",
    };
    setChatMessages(currentMessages);
    updateMainDisplay(currentMessages, selectedAvatar);

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

                // Update with streaming transcription
                setChatMessages((prevMessages) => {
                  const updatedMessages = [...prevMessages];
                  if (updatedMessages[recordingMessageIndex]) {
                    updatedMessages[recordingMessageIndex] = {
                      ...updatedMessages[recordingMessageIndex],
                      content: transcribedText,
                    };
                    updateMainDisplay(updatedMessages, selectedAvatar);
                  }
                  return updatedMessages;
                });
                setRecordingStatus(`Transcribing: "${transcribedText}"`);
              } else if (data.type === "done") {
                transcribedText = data.text;

                // Final update and send to AI
                setChatMessages((prevMessages) => {
                  const finalMessages = [...prevMessages];
                  if (
                    finalMessages[recordingMessageIndex] &&
                    transcribedText.trim()
                  ) {
                    finalMessages[recordingMessageIndex] = {
                      ...finalMessages[recordingMessageIndex],
                      content: transcribedText,
                    };
                    updateMainDisplay(finalMessages, selectedAvatar);

                    // Add the transcribed user message to chat storage
                    addMessageToSession(finalMessages[recordingMessageIndex]);

                    // Send to AI with the updated messages
                    if (selectedAvatar) {
                      sendToAI(finalMessages, selectedAvatar);
                    }
                  }
                  return finalMessages;
                });

                setRecordingStatus(`Complete: "${transcribedText}"`);

                // Clear status after 3 seconds
                setTimeout(() => {
                  setRecordingStatus("");
                }, 3000);
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
    } catch (error) {
      console.error("Error processing recording:", error);
      setRecordingStatus("Failed to transcribe audio");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleBack = async (targetState?: "grid" | "selected") => {
    // Reset timeout on user interaction
    resetTimeout();

    if (state === "chatting") {
      // End current session when leaving chat
      await endCurrentSession();

      // If targetState is specified, go directly there
      if (targetState === "grid") {
        // Going back to grid - clear all chat data and reset both screens
        setState("grid");
        setSelectedAvatar(null);
        setChatMessages([]);

        // Clear localStorage to reset main display
        handleBackResetStates();
        localStorage.setItem("kioskState", "grid");
        window.dispatchEvent(new Event("storage"));
      } else {
        // Default behavior: go back to conversation starters
        setState("selected");
        localStorage.setItem("kioskState", "selected");
        window.dispatchEvent(new Event("storage"));
      }
    } else if (state === "selected") {
      // End current session when leaving avatar selection
      await endCurrentSession();

      // Going back to grid - clear all chat data and reset both screens
      setState("grid");
      setSelectedAvatar(null);
      setChatMessages([]);

      // Clear localStorage to reset main display
      handleBackResetStates();
      localStorage.setItem("kioskState", "grid");
      window.dispatchEvent(new Event("storage"));
    }
  };

  const handleBackResetStates = () => {
    // Clear all local storage when going back to grid
    localStorage.removeItem("kioskChatMessages");
    localStorage.removeItem("kioskSelectedAvatar");
    localStorage.removeItem("kioskStreamingContent");
    localStorage.removeItem("kioskHeygenSessionId");
    localStorage.removeItem("kioskShowChat");
    setShowChatHistory(false);
  };

  const handleMouseDown = () => {
    // Reset timeout on user interaction
    resetTimeout();

    if (!isAIResponding && !isTranscribing) {
      interruptAvatar();
      startRecording();
    }
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    // Reset timeout on user interaction
    resetTimeout();

    if (!isAIResponding && !isTranscribing) {
      interruptAvatar();
      startRecording();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    }
  };

  const interruptAvatar = async () => {
    const sessionId = localStorage.getItem("kioskHeygenSessionId");
    if (sessionId) {
      await fetch("/api/avatar/interrupt", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
    }
  };

  const toggleChatHistory = () => {
    // Reset timeout on user interaction
    resetTimeout();

    const newShowChat = !showChatHistory;
    setShowChatHistory(newShowChat);
    localStorage.setItem("kioskShowChat", newShowChat.toString());
    window.dispatchEvent(new Event("storage"));
  };

  // Timeout Warning Overlay - appears on all non-grid states when warning is active
  const TimeoutWarningOverlay = () => {
    if (!showTimeoutWarning) return null;

    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        onClick={dismissTimeoutWarning}
        style={{ height: "100vh", width: "100vw" }}
      >
        <Card
          className="shadow-2xl bg-white/95 backdrop-blur-md max-w-lg mx-auto cursor-pointer transform hover:scale-105 transition-transform duration-200"
          isPressable
          onPress={dismissTimeoutWarning}
        >
          <CardBody className="text-center p-12">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto mb-6 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-5xl">⏰</span>
              </div>
              <h2 className="text-4xl font-bold mb-4 text-gray-900">
                Are you still there?
              </h2>
              <p className="text-xl text-gray-600 font-medium leading-relaxed">
                This session will end in 15 seconds due to inactivity.
                <br />
                <span className="text-warning-600 font-semibold">
                  Touch anywhere to continue.
                </span>
              </p>
            </div>

            <div className="flex justify-center">
              <Chip
                color="warning"
                variant="flat"
                size="lg"
                className="font-semibold text-lg px-6 py-3"
              >
                👆 Touch to continue
              </Chip>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  };

  if (avatars.length === 0) {
    return (
      <div
        className="fixed inset-0 w-screen h-screen overflow-hidden touch-none select-none"
        style={{ height: "100vh", maxHeight: "100vh" }}
      >
        <AnimatedBackground showRainbowHalo={true} />
        <WeatherheadLogo />
        <XLabLogo />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-lg text-gray-700 font-semibold">
            No published avatars available
          </p>
        </div>
        {/* Timeout Warning Overlay */}
        <TimeoutWarningOverlay />
      </div>
    );
  }

  // Grid view - show all avatars
  if (state === "grid") {
    return (
      <div
        className="fixed inset-0 w-screen h-screen overflow-hidden touch-none select-none"
        style={{ height: "100vh", maxHeight: "100vh" }}
      >
        <AnimatedBackground showRainbowHalo={true} />
        <WeatherheadLogo />
        <XLabLogo left="right-4" />

        <div
          className="absolute inset-0 z-10 flex flex-col p-4"
          style={{ height: "100vh" }}
        >
          <div className="text-center mb-0 flex-shrink-0">
            <h1 className="text-4xl font-bold mb-0 text-gray-800 drop-shadow-sm">
              Choose an Avatar
            </h1>
            <p className="text-xl text-gray-700 font-semibold">
              Select who you&apos;d like to chat with
            </p>
          </div>

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{
              height: "calc(100vh - 140px)",
              minHeight: "0",
            }}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 max-w-6xl mx-auto p-6">
              {avatars.map((avatar) => (
                <Card
                  key={avatar.id}
                  className="cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-105 bg-white/50 backdrop-blur-md border border-white/60"
                  isPressable
                  onPress={() => handleAvatarSelect(avatar)}
                >
                  <CardHeader className="flex flex-col items-center gap-1 pb-3">
                    <AvatarImage
                      name={avatar.name}
                      portrait={avatar.portrait}
                      size={80}
                    />
                    <div className="text-center">
                      <p className="font-semibold text-xl text-gray-800">
                        {avatar.name}
                      </p>
                      <Chip
                        size="sm"
                        color="success"
                        variant="flat"
                        className="max-w-[200px] h-auto min-h-[24px] whitespace-normal text-center"
                      >
                        <span className="text-xs leading-tight py-0.5">
                          {avatar.title}
                        </span>
                      </Chip>
                    </div>
                  </CardHeader>

                  {avatar.conversationStarters &&
                    avatar.conversationStarters.length > 0 && (
                      <CardBody className="pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1 mb-2">
                            <Zap className="w-3 h-3 text-gray-600" />
                            <p className="text-xs font-medium text-gray-600">
                              Topics:
                            </p>
                          </div>
                          {avatar.conversationStarters
                            .slice(0, 2)
                            .map((starter, idx) => (
                              <div
                                key={idx}
                                className="text-sm text-gray-600 p-1 bg-gray-100/60 rounded"
                              >
                                {starter.title}
                              </div>
                            ))}
                          {avatar.conversationStarters.length > 3 && (
                            <p className="text-xs text-gray-500">
                              +{avatar.conversationStarters.length - 3} more
                              topics...
                            </p>
                          )}
                        </div>
                      </CardBody>
                    )}
                </Card>
              ))}
            </div>
          </div>
        </div>
        {/* Timeout Warning Overlay */}
        <TimeoutWarningOverlay />
      </div>
    );
  }

  // Selected avatar view - show conversation starters
  if (state === "selected" && selectedAvatar) {
    return (
      <div
        className="fixed inset-0 w-screen h-screen overflow-hidden touch-none select-none"
        style={{ height: "100vh", maxHeight: "100vh" }}
      >
        <AnimatedBackground showRainbowHalo={true} />
        <WeatherheadLogo />
        <XLabLogo />

        {/* Loading Overlay - blocks interaction when avatar is loading */}
        {avatarLoading && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Card className="shadow-2xl bg-white/90 backdrop-blur-md max-w-md mx-auto">
              <CardBody className="text-center p-8">
                <div className="flex justify-center items-center w-full mb-6">
                  <AvatarImage
                    name={selectedAvatar.name}
                    portrait={selectedAvatar.portrait}
                    size={100}
                  />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">
                  {selectedAvatar.name} is on the way!
                </h2>
                <p className="text-lg mb-6 text-gray-600 font-semibold">
                  Please wait while your avatar gets ready...
                </p>

                <div className="w-full mb-6">
                  <Progress
                    value={loadingProgress}
                    color="primary"
                    size="lg"
                    className="mb-4"
                    label="Loading Progress"
                    showValueLabel={true}
                  />
                  <div className="text-center">
                    <Chip
                      color="primary"
                      variant="flat"
                      size="lg"
                      className="font-semibold"
                    >
                      {loadingMessage}
                    </Chip>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Chip
                    color="warning"
                    variant="flat"
                    size="lg"
                    className="font-semibold"
                  >
                    <Spinner size="sm" color="warning" /> Loading avatar...
                  </Chip>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        <div
          className="absolute inset-0 z-10 flex flex-col p-4"
          style={{ height: "100vh" }}
        >
          <div className="flex items-center gap-4 mb-0 flex-shrink-0 justify-end">
            <Button
              onPress={() => handleBack()}
              className="bg-white/50 backdrop-blur-md px-8 py-6"
              size="lg"
              variant="light"
              isDisabled={avatarLoading}
            >
              <OctagonX className="w-9 h-9 text-red-600" />
              <p className="text-lg font-medium text-gray-700">
                Select Another Avatar
              </p>
            </Button>
          </div>

          <ScrollShadow
            className="flex-1 flex flex-col items-center justify-start max-w-2xl mx-auto overflow-y-auto"
            style={{
              height: "calc(100vh - 120px)",
              minHeight: "0",
            }}
          >
            <div className="flex-shrink-0 text-center">
              <div className="flex justify-center items-center w-full">
                <AvatarImage
                  name={selectedAvatar.name}
                  portrait={selectedAvatar.portrait}
                  size={150}
                />
              </div>
              <h2 className="text-4xl font-bold mt-6 mb-2 text-gray-800 drop-shadow-sm">
                {selectedAvatar.name}
              </h2>
            </div>

            {selectedAvatar.conversationStarters &&
            selectedAvatar.conversationStarters.length > 0 ? (
              <div className="w-full space-y-4 mt-8 pb-6">
                <div className="text-center mb-6">
                  <h3 className="text-3xl font-semibold mb-2 text-gray-800">
                    Choose a conversation starter:
                  </h3>
                  <p className="text-gray-700 font-medium text-lg">
                    Select one of the{" "}
                    {selectedAvatar.conversationStarters.length} topics below to
                    begin chatting
                  </p>
                </div>

                <div className="grid gap-4">
                  {selectedAvatar.conversationStarters.map((starter, idx) => (
                    <Button
                      key={idx}
                      variant="bordered"
                      size="lg"
                      className="h-auto p-5 text-left justify-start bg-white/50 backdrop-blur-md border-white/60 hover:bg-white/70"
                      onPress={() => handleStarterSelect(starter)}
                      isDisabled={avatarLoading}
                    >
                      <div className="text-left">
                        <div className="font-semibold text-xl mb-2 text-gray-800">
                          {starter.title}
                        </div>
                        <div className="text-base text-gray-600">
                          {starter.question}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center mt-8">
                <p className="text-lg text-gray-700 font-medium">
                  No conversation starters available for this avatar.
                </p>
                <Button
                  variant="bordered"
                  onPress={() => handleBack()}
                  className="mt-4 bg-white/50 backdrop-blur-md border-white/60 px-8 py-4 text-lg"
                  size="lg"
                  isDisabled={avatarLoading}
                >
                  Choose Different Avatar
                </Button>
              </div>
            )}
          </ScrollShadow>
        </div>
        {/* Timeout Warning Overlay */}
        <TimeoutWarningOverlay />
      </div>
    );
  }

  // Chatting view - show push-to-talk controls
  if (state === "chatting" && selectedAvatar) {
    return (
      <div
        className="fixed inset-0 w-screen h-screen overflow-hidden touch-none select-none"
        style={{ height: "100vh", maxHeight: "100vh" }}
      >
        <AnimatedBackground showRainbowHalo={true} />
        <WeatherheadLogo />
        <XLabLogo />

        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-12"
          style={{ height: "100vh" }}
        >
          {/* Left Side - QR Code */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 mr-20">
            <QRCodeDisplay
              selectedAvatar={selectedAvatar}
              sessionId={currentSessionId}
              className="w-72"
            />
          </div>

          {/* Center Content */}
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="flex flex-col items-center justify-center bg-white/40 backdrop-blur-lg rounded-3xl p-12 text-center border border-white/60 shadow-xl">
              {/* Title */}
              <h1 className="text-3xl text-gray-700 mb-5">
                You are chatting with
              </h1>

              {selectedAvatar ? (
                <>
                  {/* Avatar Photo */}
                  <div className="mb-8 rounded-full">
                    <AvatarImage
                      name={selectedAvatar.name}
                      portrait={selectedAvatar.portrait}
                      size={200}
                    />
                  </div>

                  {/* Name */}
                  <h2 className="text-4xl text-gray-900 mb-4">
                    {selectedAvatar.name}
                  </h2>

                  {/* Title */}
                  <p className="text-xl text-gray-600 mb-10">
                    {selectedAvatar.title ||
                      selectedAvatar.description ||
                      "AI Assistant"}
                  </p>

                  {/* Bottom Disclaimer */}
                  <div className="text-gray-600 bg-warning-500/20 rounded-xl p-3">
                    AI can make mistakes. A transcript of this conversation will
                    be retained.
                    <br />
                    Please do not share personal information.
                  </div>

                  {/* Conversation Starter */}
                  {chatMessages.length === 0 && (
                    <div className="text-left bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-lg">
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        Conversation starter:
                      </p>
                      <p className="text-base text-gray-800 font-medium leading-relaxed">
                        {selectedAvatar?.conversationStarters &&
                        selectedAvatar.conversationStarters.length > 0
                          ? selectedAvatar.conversationStarters[0].question
                          : "How can I help you today?"}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* No Avatar Selected State */}
                  <div className="w-72 h-72 mx-auto mb-8 rounded-3xl bg-white/30 backdrop-blur-md shadow-lg flex items-center justify-center border border-white/50">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-white/50 mx-auto mb-4 flex items-center justify-center">
                        <span className="text-3xl text-gray-500">👤</span>
                      </div>
                      <p className="text-gray-600 font-medium">
                        No avatar selected
                      </p>
                    </div>
                  </div>

                  {/* None Selected Message */}
                  <h2 className="text-4xl font-medium text-gray-700 mb-4">
                    None selected
                  </h2>

                  {/* Instructions */}
                  <p className="text-xl font-medium text-gray-600 mb-10">
                    Choose &quot;Change Avatar&quot; to select a professor and
                    start chatting
                  </p>

                  {/* No Conversation Starter */}
                  <div className="text-left bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/80 shadow-lg">
                    <p className="text-sm font-medium text-gray-600 mb-3">
                      Conversation starter:
                    </p>
                    <p className="text-base text-gray-700 font-medium leading-relaxed">
                      Select an avatar to see conversation options
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Side - Control Buttons */}
          <div className="flex flex-col items-center justify-between flex-shrink-0 ml-20 h-full">
            {/* Reset Chat Button */}
            <div className="flex flex-col items-center gap-1">
              <Button
                className="w-24 h-24 rounded-full bg-red-50/80 hover:bg-red-100/80 border border-red-200 transition-all duration-200 backdrop-blur-md"
                isIconOnly
                size="lg"
                onPress={() => {
                  handleBack("grid");
                }}
              >
                <OctagonX className="w-9 h-9 text-red-500" />
              </Button>
              <p className="text-base font-medium text-gray-700 text-center leading-tight">
                End Conversation
              </p>
            </div>

            {/* Change Avatar Button */}
            {/* <div className="flex flex-col items-center gap-1">
              <Button
                className="w-24 h-24 rounded-full bg-cyan-50/80 hover:bg-cyan-100/80 border border-cyan-200 transition-all duration-200 backdrop-blur-md"
                isIconOnly
                size="lg"
                onPress={() => {
                  handleBack("selected");
                }}
              >
                <RefreshCcw className="w-9 h-9 text-cyan-600" />
              </Button>
              <p className="text-base font-medium text-gray-700 text-center leading-tight">
                Select Another Topic
              </p>
            </div> */}

            {/* Show Chat History Toggle */}
            <div className="flex flex-col items-center gap-1">
              <Button
                className={`w-24 h-24 rounded-full border transition-all duration-200 backdrop-blur-md ${
                  showChatHistory
                    ? "bg-blue-50/80 border-blue-200 hover:bg-blue-100/80"
                    : "bg-gray-50/80 border-gray-200 hover:bg-gray-100/80"
                }`}
                isIconOnly
                size="lg"
                onPress={toggleChatHistory}
              >
                {showChatHistory ? (
                  <MessageSquareOff className="w-9 h-9 text-blue-600" />
                ) : (
                  <MessageSquare className="w-9 h-9 text-gray-600" />
                )}
              </Button>
              <p className="text-base font-medium text-gray-700 text-center leading-tight">
                {showChatHistory ? "Hide Chat History" : "Show Chat History"}
              </p>
            </div>

            {/* Hold to Talk Button */}
            <div className="flex flex-col items-center gap-1">
              <Button
                className={`w-48 h-48 rounded-full transition-all duration-300 shadow-lg ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 scale-110 shadow-red-200"
                    : isAIResponding
                      ? "bg-gray-300 shadow-gray-200"
                      : "bg-blue-500 hover:bg-blue-600 shadow-blue-200"
                }`}
                isIconOnly
                size="lg"
                isDisabled={isAIResponding || isTranscribing}
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
                  <MicOff className="w-16 h-16 text-white opacity-50" />
                ) : (
                  <Mic className="w-16 h-16 text-white" />
                )}
              </Button>
              <p className="text-4xl font-medium text-gray-800">
                <strong>Hold</strong> to talk
              </p>
            </div>
          </div>
        </div>
        {/* Timeout Warning Overlay */}
        <TimeoutWarningOverlay />
      </div>
    );
  }

  return null;
}
