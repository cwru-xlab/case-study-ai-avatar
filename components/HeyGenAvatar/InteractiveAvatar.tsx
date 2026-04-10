import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import { StartAvatarRequest } from "@/types";
import { Button } from "@heroui/button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { useTextChat } from "./logic/useTextChat";
import { useInterrupt } from "./logic/useInterrupt";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoaderCircle, Circle, Square } from "lucide-react";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import { TextInput } from "./AvatarSession/TextInput";
import { Card } from "@heroui/card";
import { Unplug } from "lucide-react";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: "low",
  avatarName: "Ann_Therapist_public",
  knowledgeId: undefined,
  voice: {
    rate: 1.1,
    voiceId: "df6420135ba44094b85874084b45c410",
    emotion: undefined,
  },
  language: "en",
};

export interface InteractiveAvatarRef {
  speak: (text: string) => void;
  startSession: () => Promise<void>;
  stopSession: () => void;
  interrupt: () => void;
}

interface InteractiveAvatarWrapperProps {
  config?: StartAvatarRequest;
  showHistory?: boolean;
  autoStart?: boolean;
  cleanMode?: boolean;
  onProgrammaticSpeak?: (speak: (text: string) => void) => void;
  onSessionStateChange?: (state: StreamingAvatarSessionState) => void;
}

async function fetchSessionToken(config: StartAvatarRequest): Promise<string> {
  const response = await fetch("/api/avatar/get-access-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      avatar_id: config.avatarName,
      voice_id: config.voice.voiceId,
      language: config.language,
    }),
  });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || "Failed to get session token");
  }
  const data = await response.json();
  return data.session_token;
}

// --- Inner component: rendered only when we have a token and want an active session ---

const ActiveSession = forwardRef<
  InteractiveAvatarRef,
  {
    showHistory: boolean;
    cleanMode: boolean;
    onProgrammaticSpeak?: (speak: (text: string) => void) => void;
    onSessionStateChange?: (state: StreamingAvatarSessionState) => void;
  }
>(({ showHistory, cleanMode, onProgrammaticSpeak, onSessionStateChange }, ref) => {
  const {
    startSession,
    stopAvatar,
    sessionState,
    isStreamReady,
    attachElement,
  } = useStreamingAvatarSession();
  const { repeatMessage } = useTextChat();
  const { interrupt } = useInterrupt();

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const startedRef = useRef(false);

  // Start session exactly once on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startSession();
    }
  }, [startSession]);

  // Notify parent of session state changes
  useEffect(() => {
    onSessionStateChange?.(sessionState);
  }, [sessionState, onSessionStateChange]);

  // Attach video element when stream is ready
  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
      localStorage.setItem("kioskAvatarStreamReady", "true");
      window.dispatchEvent(new Event("storage"));
    }
  }, [isStreamReady, attachElement]);

  useEffect(() => {
    if (
      onProgrammaticSpeak &&
      sessionState === StreamingAvatarSessionState.CONNECTED
    ) {
      onProgrammaticSpeak((text: string) => {
        repeatMessage(text);
      });
    }
  }, [onProgrammaticSpeak, repeatMessage, sessionState]);

  useImperativeHandle(
    ref,
    () => ({
      speak: (text: string) => repeatMessage(text),
      startSession: async () => { await startSession(); },
      stopSession: () => stopAvatar(),
      interrupt: () => interrupt(),
    }),
    [repeatMessage, startSession, stopAvatar, interrupt],
  );

  useUnmount(() => {
    if (isRecording) stopRecording();
    stopAvatar();
  });

  const startRecording = useMemoizedFn(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      recordedChunksRef.current = [];
      const stream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `avatar-recording-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  });

  const stopRecording = useMemoizedFn(() => {
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
  });

  const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;

  if (cleanMode) {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        >
          <track kind="captions" />
        </video>
        {!isLoaded && (
          <div className="w-full h-full flex flex-col items-center justify-center absolute top-0 left-0 bg-black">
            <LoaderCircle className="animate-spin text-white/70 mb-3" size={32} />
            <p className="text-white/60 text-sm">Connecting to avatar...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="flex flex-col rounded-xl overflow-hidden w-full">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          <AvatarVideo ref={videoRef} />
          {isRecording && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-danger/90 text-white px-3 py-1.5 rounded-full">
              <Circle size={12} fill="currentColor" className="animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t w-full">
          {isLoaded ? (
            <>
              <TextInput />
              <div className="flex flex-row">
                <Button
                  color={isRecording ? "danger" : "primary"}
                  variant="flat"
                  onPress={isRecording ? stopRecording : startRecording}
                  startContent={
                    isRecording
                      ? <Square size={16} fill="currentColor" />
                      : <Circle size={16} fill="currentColor" />
                  }
                >
                  {isRecording ? "Stop Recording" : "Record"}
                </Button>
              </div>
            </>
          ) : (
            <LoaderCircle className="animate-spin" size={20} />
          )}
        </div>
      </Card>
      {showHistory && isLoaded && <MessageHistory />}
    </div>
  );
});
ActiveSession.displayName = "ActiveSession";

// --- Wrapper: manages token lifecycle, renders ActiveSession only when starting ---

const InteractiveAvatarWrapper = forwardRef<
  InteractiveAvatarRef,
  InteractiveAvatarWrapperProps
>(({ config = DEFAULT_CONFIG, showHistory = true, autoStart = false, cleanMode = false, onProgrammaticSpeak, onSessionStateChange }, ref) => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;
  const innerRef = useRef<InteractiveAvatarRef>(null);

  const effectiveAutoStart = cleanMode || autoStart;
  const effectiveShowHistory = cleanMode ? false : showHistory;

  // The single atomic action: fetch token (which will mount the Provider+ActiveSession)
  const triggerStart = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    try {
      const token = await fetchSessionToken(configRef.current);
      setSessionToken(token);
    } catch (err) {
      console.error("Error starting session:", err);
      setError((err as Error).message);
      setSessionToken(null);
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Auto-start on mount
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (effectiveAutoStart && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      triggerStart();
    }
  }, [effectiveAutoStart, triggerStart]);

  const handleStop = useCallback(() => {
    innerRef.current?.stopSession();
    setSessionToken(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      speak: (text: string) => innerRef.current?.speak(text),
      startSession: triggerStart,
      stopSession: handleStop,
      interrupt: () => innerRef.current?.interrupt(),
    }),
    [triggerStart, handleStop],
  );

  // Error state
  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-2 p-4">
        <p className="text-danger text-sm">Error: {error}</p>
        <Button size="sm" color="primary" onClick={triggerStart}>
          Retry
        </Button>
      </div>
    );
  }

  // No token yet and not auto-starting => show idle UI with Start button
  if (!sessionToken && !isStarting) {
    if (cleanMode) {
      return (
        <div className="w-full aspect-video relative overflow-hidden rounded-xl">
          <div className="flex flex-col items-center justify-center gap-2 w-full h-full bg-default-100">
            <Unplug size={20} />
            <p>Disconnected</p>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full flex flex-col gap-4">
        <Card className="flex flex-col rounded-xl overflow-hidden w-full">
          <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <Unplug size={20} />
              <p>Disconnected</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 items-center justify-center p-4 border-t w-full">
            <Button color="primary" onClick={triggerStart}>
              Start Real-Time Avatar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Token is being fetched
  if (!sessionToken) {
    if (cleanMode) {
      return (
        <div className="w-full aspect-video relative overflow-hidden rounded-xl">
          <div className="w-full h-full flex items-center justify-center">
            <LoaderCircle className="animate-spin" size={20} />
          </div>
        </div>
      );
    }
    return (
      <div className="w-full flex items-center justify-center p-4">
        <LoaderCircle className="animate-spin" size={20} />
      </div>
    );
  }

  // Token ready => mount Provider + ActiveSession (which auto-starts on mount)
  return (
    <StreamingAvatarProvider key={sessionToken} sessionAccessToken={sessionToken} voiceChatConfig={false}>
      <ActiveSession
        ref={innerRef}
        showHistory={effectiveShowHistory}
        cleanMode={cleanMode}
        onProgrammaticSpeak={onProgrammaticSpeak}
        onSessionStateChange={onSessionStateChange}
      />
    </StreamingAvatarProvider>
  );
});
InteractiveAvatarWrapper.displayName = "InteractiveAvatarWrapper";

export default InteractiveAvatarWrapper;
