"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import AvatarImage from "@/components/AvatarImage";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { type CachedAvatar } from "@/lib/avatar-storage";
import InteractiveAvatarWrapper, {
  InteractiveAvatarRef,
} from "@/components/HeyGenAvatar/InteractiveAvatar";
import {
  AnimatedBackground,
  WeatherheadLogo,
  XLabLogo,
  ThinkingIndicator,
  LanguageBanner,
  VideoCarousel,
  AvatarIntroduction,
  DirectionArrow,
  SpecialEventOverlay,
  type VideoItem,
} from "@/components/kiosk";
import type { Avatar } from "@/lib/avatar-storage";

// Reusable markdown message component
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function MainDisplay() {
  const [selectedAvatar, setSelectedAvatar] = useState<CachedAvatar | null>(
    null
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [showChatOverlay, setShowChatOverlay] = useState<boolean>(false);
  const [kioskState, setKioskState] = useState<string>("grid"); // grid, selected, chatting
  const [avatarReady, setAvatarReady] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [isAIResponding, setIsAIResponding] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<InteractiveAvatarRef>(null);
  const pendingSpeechRef = useRef<string | null>(null);

  // Carousel active state
  const [activeCarouselVideo, setActiveCarouselVideo] =
    useState<VideoItem | null>(null);
  const [activeCarouselAvatar, setActiveCarouselAvatar] =
    useState<Avatar | null>(null);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState<number>(0);

  // Airplane-themed loading messages
  const loadingMessages = [
    "Going to the airport",
    "Going through security",
    "Boarding the aircraft",
    "Taking off",
    "Climbing to altitude",
    "At cruising altitude",
    "Beginning descent",
    "Landing safely",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamingContent]);

  useEffect(() => {
    // Clean start - only reset UI state, not speech handling
    const initializeCleanState = () => {
      setSelectedAvatar(null);
      setChatMessages([]);
      setStreamingContent("");
      setShowChatOverlay(false);
      setKioskState("grid");
      // Don't reset pendingSpeechRef here as it might interfere with speech
    };

    const handleStorageChange = () => {
      // Get selected avatar
      const avatarData = localStorage.getItem("kioskSelectedAvatar");
      if (avatarData) {
        try {
          const avatar = JSON.parse(avatarData);
          setSelectedAvatar(avatar);
        } catch (error) {
          setSelectedAvatar(null);
          console.error("Error parsing selected avatar:", error);
        }
      } else {
        // Avatar data was cleared - reset to welcome screen
        setSelectedAvatar(null);
      }

      // Get chat messages
      const messagesData = localStorage.getItem("kioskChatMessages");
      if (messagesData) {
        try {
          const messages = JSON.parse(messagesData);
          setChatMessages(messages);
        } catch (error) {
          console.error("Error parsing chat messages:", error);
        }
      } else {
        // Messages were cleared - reset chat
        setChatMessages([]);
      }

      // Get streaming content
      const streamingData = localStorage.getItem("kioskStreamingContent");
      if (streamingData) {
        setStreamingContent(streamingData);
      } else {
        setStreamingContent("");
      }

      // Get chat overlay visibility state
      const showChatData = localStorage.getItem("kioskShowChat");
      setShowChatOverlay(showChatData === "true");

      // Get kiosk state
      const stateData = localStorage.getItem("kioskState");
      console.log("Main display: kiosk state changed to:", stateData);
      if (stateData) {
        setKioskState(stateData);
      } else {
        setKioskState("grid");
      }

      // Check for AI response to speak
      const aiResponseToSpeak = localStorage.getItem("kioskAIResponseToSpeak");
      if (aiResponseToSpeak) {
        console.log("Found AI response to speak:", aiResponseToSpeak);
        if (avatarRef.current) {
          console.log("Avatar ref available, triggering speech immediately");
          avatarRef.current.speak(aiResponseToSpeak);
          localStorage.removeItem("kioskAIResponseToSpeak");
        } else {
          console.log("Avatar not ready, storing for later");
          pendingSpeechRef.current = aiResponseToSpeak;
          localStorage.removeItem("kioskAIResponseToSpeak");
        }
      }

      // Check for avatar stream ready signal
      const streamReady = localStorage.getItem("kioskAvatarStreamReady");
      if (streamReady === "true") {
        console.log("Avatar stream is ready - completing loading process");

        // Complete the loading process
        setLoadingProgress(100);
        setLoadingMessage("Ready to chat!");
        setAvatarReady(true);

        // Update localStorage for touch screen sync
        localStorage.setItem("kioskLoadingProgress", "100");
        localStorage.setItem("kioskLoadingMessage", "Ready to chat!");

        // Clear all loading state
        localStorage.removeItem("kioskAvatarLoading");
        localStorage.removeItem("kioskLoadingProgress");
        localStorage.removeItem("kioskLoadingMessage");
        localStorage.removeItem("kioskAvatarStreamReady");

        window.dispatchEvent(new Event("storage"));
      }

      // Check for AI responding state
      const aiResponding = localStorage.getItem("kioskIsAIResponding");
      if (aiResponding !== null) {
        setIsAIResponding(aiResponding === "true");
      }
    };

    // Only initialize clean state if we're actually starting fresh
    const currentState = localStorage.getItem("kioskState");
    if (!currentState || currentState === "grid") {
      initializeCleanState();
    }

    // Listen for storage changes from touch screen
    window.addEventListener("storage", handleStorageChange);

    // Initial load
    handleStorageChange();

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Handle 10-second avatar loading timer with progress and messages
  useEffect(() => {
    if (kioskState === "selected") {
      // Reset avatar ready state when entering selected state
      setAvatarReady(false);
      setLoadingProgress(0);
      setLoadingMessage(loadingMessages[0]);

      // Update loading state in localStorage for touch screen sync
      localStorage.setItem("kioskAvatarLoading", "true");
      localStorage.setItem("kioskLoadingProgress", "0");
      localStorage.setItem("kioskLoadingMessage", loadingMessages[0]);
      window.dispatchEvent(new Event("storage"));

      const totalDuration = 10000; // 10 seconds
      const intervalTime = 100; // Update every 100ms
      const totalSteps = totalDuration / intervalTime;
      const messagesPerStep = totalSteps / loadingMessages.length;

      let currentStep = 0;

      const progressInterval = setInterval(() => {
        currentStep++;
        // Cap progress at 99% - only STREAM_READY callback can complete it
        const progress = Math.min((currentStep / totalSteps) * 100, 99);
        const messageIndex = Math.min(
          Math.floor(currentStep / messagesPerStep),
          loadingMessages.length - 1
        );

        setLoadingProgress(progress);
        setLoadingMessage(loadingMessages[messageIndex]);

        // Update localStorage for touch screen sync
        localStorage.setItem("kioskLoadingProgress", progress.toString());
        localStorage.setItem(
          "kioskLoadingMessage",
          loadingMessages[messageIndex]
        );
        window.dispatchEvent(new Event("storage"));

        // Timer no longer sets avatar ready - only STREAM_READY callback can do that
        if (currentStep >= totalSteps) {
          clearInterval(progressInterval);
          // Avatar ready logic moved to STREAM_READY callback
        }
      }, intervalTime);

      return () => {
        clearInterval(progressInterval);
        // Clear loading state in localStorage
        localStorage.removeItem("kioskAvatarLoading");
        localStorage.removeItem("kioskLoadingProgress");
        localStorage.removeItem("kioskLoadingMessage");
      };
    }
  }, [kioskState]);

  // Handle pending speech when avatar becomes ready
  useEffect(() => {
    if (avatarRef.current && pendingSpeechRef.current) {
      console.log(
        "Avatar is now ready, triggering pending speech:",
        pendingSpeechRef.current
      );
      const timeoutId = setTimeout(() => {
        if (avatarRef.current && pendingSpeechRef.current) {
          avatarRef.current.speak(pendingSpeechRef.current);
          pendingSpeechRef.current = null;
        }
      }, 2000); // Wait 2 seconds for avatar to be fully connected

      return () => clearTimeout(timeoutId);
    }
  }, [kioskState, avatarRef.current]);

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

  // Fixed parent container wrapper - prevents ALL scrolling
  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden touch-none select-none"
      style={{ height: "100vh", maxHeight: "100vh" }}
    >
      {/* Welcome screen when no avatar is selected */}
      {(!selectedAvatar || kioskState === "grid") ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <AnimatedBackground />
          <WeatherheadLogo className="h-24 w-auto object-contain" />
          <XLabLogo className="h-20 w-auto object-contain" bottom="bottom-8" />
          <ThinkingIndicator isVisible={isAIResponding} />

          {/* Main Content - Absolutely no scroll, responsive layout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
            <div className="text-right w-full max-w-full h-full flex flex-col justify-start mt-8 mr-60">
              {/* Main Title - Responsive */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-4 md:mb-4 text-gray-800 drop-shadow-lg">
                Chat with a Weatherhead faculty avatar
              </h1>

              {/* Simple Instructions - Responsive Stack */}
              {/* <div className="flex flex-col lg:flex-row justify-center items-center gap-8 lg:gap-16 text-gray-800">
                <div className="flex flex-col items-center gap-3">
                  <Card className="shadow-xl bg-white/40 backdrop-blur-lg border border-white/50">
                    <CardBody className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center p-0">
                      <span className="text-4xl sm:text-5xl">👥</span>
                    </CardBody>
                  </Card>
                  <Chip
                    size="lg"
                    className="text-2xl sm:text-2xl font-bold shadow-lg bg-blue-100 text-blue-800 border-blue-200"
                    variant="bordered"
                  >
                    Browse Avatars
                  </Chip>
                </div>
                <div className="text-gray-500 text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-sm rotate-90 lg:rotate-0">
                  →
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Card className="shadow-xl bg-white/40 backdrop-blur-lg border border-white/50">
                    <CardBody className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center p-0">
                      <span className="text-4xl sm:text-5xl">🎯</span>
                    </CardBody>
                  </Card>
                  <Chip
                    size="lg"
                    className="text-2xl sm:text-2xl font-bold text-center max-w-[220px] shadow-lg bg-purple-100 text-purple-800 border-purple-200"
                    variant="bordered"
                  >
                    Select Avatar & Choose Conversation Starter
                  </Chip>
                </div>
                <div className="text-gray-500 text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-sm rotate-90 lg:rotate-0">
                  →
                </div>
                <div className="flex flex-col items-center gap-3">
                  <Card className="shadow-xl bg-white/40 backdrop-blur-lg border border-white/50">
                    <CardBody className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center p-0">
                      <span className="text-4xl sm:text-5xl">💬</span>
                    </CardBody>
                  </Card>
                  <Chip
                    size="lg"
                    className="text-2xl sm:text-2xl font-bold shadow-lg bg-green-100 text-green-800 border-green-200"
                    variant="bordered"
                  >
                    Chat
                  </Chip>
                </div>
              </div> */}
            </div>
            {/* Video Carousel with instruction text on the right */}
            <div className="flex flex-row items-end justify-start gap-1 w-full">
              {/* Video Carousel Component */}
              <VideoCarousel
                onActiveChange={(video, avatar, index) => {
                  setActiveCarouselVideo(video);
                  setActiveCarouselAvatar(avatar);
                  setActiveCarouselIndex(index);
                }}
              />

              {/* Avatar Introduction and Instruction Section */}
              <div className="flex flex-col justify-start items-start gap-40 max-w-3xl pb-20">
                {/* Avatar Introduction */}
                <AvatarIntroduction
                  activeVideo={activeCarouselVideo}
                  activeAvatar={activeCarouselAvatar}
                  activeIndex={activeCarouselIndex}
                />

                {/* Instruction text with arrow pointing right */}
                <div className="flex items-center gap-10">
                  <p className="text-2xl sm:text-3xl md:text-4xl text-right max-w-xl text-gray-700 font-semibold drop-shadow-sm">
                    Choose an avatar on the touch screen to start a conversation
                  </p>
                  <DirectionArrow
                    rotation={40}
                    size={10}
                    color="rgb(55, 65, 81)"
                    glowColor="rgba(59, 130, 246, 0.5)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Special Event Overlay - Only appears in grid state */}
          <SpecialEventOverlay
            imageSrc="/special-event-1.png"
            intervalSeconds={60}
            displayDurationSeconds={15}
            borderWidth={12}
            borderColor="#3b82f6"
            cornerRadius={20}
          />
        </div>
      ) : (
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
          <WeatherheadLogo className="h-24 w-auto object-contain" />
          <XLabLogo className="h-20 w-auto object-contain" bottom="bottom-8" />
          <ThinkingIndicator isVisible={isAIResponding} />

          {/* Clean Mode Avatar - Full Screen (loads when avatar is selected) */}
          {(() => {
            const shouldRenderVideo =
              selectedAvatar &&
              (kioskState === "selected" || kioskState === "chatting");
            if (shouldRenderVideo) {
              console.log(
                "Main display: Rendering avatar video for state:",
                kioskState,
                "avatar:",
                selectedAvatar.name
              );
            }
            return (
              shouldRenderVideo && (
                <div className="absolute inset-0 w-full h-full">
                  <InteractiveAvatarWrapper
                    ref={avatarRef}
                    config={selectedAvatar.settings}
                    cleanMode={true}
                  />
                </div>
              )
            );
          })()}

          {/* Blur Overlay for "selected" state */}
          {selectedAvatar && kioskState === "selected" && (
            <div className="absolute inset-0 w-full h-full bg-white bg-opacity-80 backdrop-blur-sm flex flex-col">
              <div className="flex-1 flex items-center justify-center">
                <Card className="shadow-xl bg-white/90 backdrop-blur-md">
                  <CardBody className="text-center p-12">
                    <div className="flex justify-center items-center w-full mb-8">
                      <AvatarImage
                        name={selectedAvatar.name}
                        portrait={selectedAvatar.portrait}
                        size={130}
                      />
                    </div>
                    <h1 className="text-5xl font-bold mb-6 text-gray-900">
                      {avatarReady
                        ? `${selectedAvatar.name} is here to chat!`
                        : `${selectedAvatar.name} is on the way!`}
                    </h1>
                    <p className="text-2xl mb-8 text-gray-600 font-semibold">
                      {avatarReady
                        ? "Choose a conversation starter on the touch screen to begin"
                        : "Please wait while your avatar gets ready..."}
                    </p>

                    {!avatarReady && (
                      <div className="w-full max-w-md mx-auto mb-6">
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
                            className="font-semibold text-xl"
                          >
                            {loadingMessage}
                          </Chip>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-3">
                      <Chip
                        color={avatarReady ? "success" : "warning"}
                        variant="flat"
                        size="lg"
                        className="font-semibold text-xl"
                      >
                        {avatarReady ? (
                          "Avatar is ready - Choose a topic to start!"
                        ) : (
                          <>
                            <Spinner size="sm" color="warning" /> Loading
                            avatar...
                          </>
                        )}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {/* Semi-transparent Chat Overlay - Right Side */}
          {showChatOverlay && kioskState === "chatting" && (
            <div className="absolute right-0 w-1/3 h-full bg-black bg-opacity-70 backdrop-blur-sm rounded-l-2xl">
              <div className="h-full flex flex-col p-6">
                {/* Header */}
                <Card className="mb-4 bg-white/10 backdrop-blur-md">
                  <CardBody className="flex flex-row items-center gap-3 p-4">
                    <AvatarImage
                      name={selectedAvatar.name}
                      portrait={selectedAvatar.portrait}
                      size={40}
                    />
                    <div>
                      <h2 className="text-white font-bold text-lg">
                        {selectedAvatar.name}
                      </h2>
                      <Chip
                        color="default"
                        variant="flat"
                        size="sm"
                        className="text-white/70 bg-white/10"
                      >
                        Conversation History
                      </Chip>
                    </div>
                  </CardBody>
                </Card>

                {/* Chat Messages */}
                <div className="flex-1 overflow-hidden">
                  <ScrollShadow
                    className="h-full custom-scrollbar"
                    style={{
                      scrollbarColor: "rgba(255, 255, 255, 0.3) transparent",
                    }}
                  >
                    <style>{`
                       :global(.custom-scrollbar) ::-webkit-scrollbar {
                         width: 8px;
                       }
                       :global(.custom-scrollbar) ::-webkit-scrollbar-track {
                         background: transparent;
                       }
                       :global(.custom-scrollbar) ::-webkit-scrollbar-thumb {
                         background: rgba(255, 255, 255, 0.3);
                         border-radius: 4px;
                         border: none;
                       }
                       :global(.custom-scrollbar) ::-webkit-scrollbar-thumb:hover {
                         background: rgba(255, 255, 255, 0.5);
                       }
                       :global(.custom-scrollbar) ::-webkit-scrollbar-corner {
                         background: transparent;
                       }
                       
                       /* For Firefox */
                       :global(.custom-scrollbar) {
                         scrollbar-width: thin;
                         scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
                       }
                     `}</style>
                    {chatMessages.length === 0 && !streamingContent ? (
                      <Card className="h-full bg-white/5 backdrop-blur-sm">
                        <CardBody className="flex flex-col items-center justify-center h-full">
                          <Bot className="w-12 h-12 mb-4 text-white/70" />
                          <Chip
                            color="default"
                            variant="flat"
                            size="md"
                            className="text-white/70 bg-white/10 font-semibold"
                          >
                            Conversation will appear here
                          </Chip>
                        </CardBody>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex items-start gap-3 ${
                              message.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            {message.role === "assistant" && (
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3 h-3 text-white" />
                              </div>
                            )}

                            <div
                              className={`max-w-[85%] p-3 rounded-xl text-sm ${
                                message.role === "user"
                                  ? "bg-blue-500 bg-opacity-80 text-white"
                                  : "bg-white bg-opacity-15 text-white backdrop-blur-sm"
                              }`}
                            >
                              {/* Show different states for user messages */}
                              {message.role === "user" &&
                              message.content === "🎤 Recording..." ? (
                                <div className="flex items-center gap-2">
                                  <Spinner
                                    size="sm"
                                    color="white"
                                    variant="wave"
                                  />
                                  <Chip
                                    color="primary"
                                    variant="flat"
                                    size="sm"
                                    className="text-white font-semibold"
                                  >
                                    Listening...
                                  </Chip>
                                </div>
                              ) : message.role === "user" &&
                                message.content === "📝 Transcribing..." ? (
                                <div className="flex items-center gap-2">
                                  <Spinner
                                    size="sm"
                                    color="white"
                                    variant="dots"
                                  />
                                  <Chip
                                    color="secondary"
                                    variant="flat"
                                    size="sm"
                                    className="text-white font-semibold"
                                  >
                                    Processing speech...
                                  </Chip>
                                </div>
                              ) : message.role === "user" &&
                                (message.content.includes("🎤") ||
                                  message.content.includes("📝")) ? (
                                // Handle special recording/transcribing states
                                <div className="flex items-center gap-2">
                                  <Spinner
                                    size="sm"
                                    color="white"
                                    variant="dots"
                                  />
                                  <Chip
                                    color="warning"
                                    variant="flat"
                                    size="sm"
                                    className="text-white font-semibold"
                                  >
                                    Processing speech...
                                  </Chip>
                                </div>
                              ) : (
                                <div className="text-left">
                                  {message.role === "assistant" ? (
                                    <div className="whitespace-pre-wrap leading-relaxed font-medium">
                                      <MarkdownMessage
                                        content={message.content}
                                      />
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-wrap leading-relaxed font-semibold">
                                      {message.content}
                                    </p>
                                  )}
                                </div>
                              )}

                              <p className="text-xs opacity-60 mt-1 font-medium">
                                {new Date(
                                  message.timestamp
                                ).toLocaleTimeString()}
                              </p>
                            </div>

                            {message.role === "user" && (
                              <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
                                <User className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Streaming AI Response */}
                        {streamingContent && (
                          <div className="flex items-start gap-3 justify-start">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-3 h-3 text-white" />
                            </div>
                            <div className="max-w-[85%] p-3 rounded-xl bg-white bg-opacity-20 text-white backdrop-blur-sm text-sm">
                              <div className="whitespace-pre-wrap leading-relaxed text-left font-medium">
                                <MarkdownMessage content={streamingContent} />
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Spinner
                                  size="sm"
                                  variant="dots"
                                  color="white"
                                />
                                <Chip
                                  color="primary"
                                  variant="flat"
                                  size="sm"
                                  className="text-white/80 bg-white/10 font-semibold"
                                >
                                  AI is typing...
                                </Chip>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </ScrollShadow>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Language Banner - Always visible at bottom */}
      <LanguageBanner />
    </div>
  );
}
