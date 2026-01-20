import { StreamingEvents } from "@heygen/streaming-avatar";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import { StartAvatarRequest } from "@/types";
import { Button } from "@heroui/button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { useVoiceChat } from "./logic/useVoiceChat";
import { useTextChat } from "./logic/useTextChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoaderCircle, Circle, Square } from "lucide-react";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import { TextInput } from "./AvatarSession/TextInput";
import { Card } from "@heroui/card";
import { Unplug } from "lucide-react";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: "low", // High="high", Medium="medium", Low="low"
  avatarName: "Ann_Therapist_public", // text field with no validation.
  knowledgeId: undefined, // leave undefined for default, in the UI, lock this
  voice: {
    rate: 1.1, // 0.5 - 2.0 use heroui slider, step 0.1, default 1.1
    voiceId: "df6420135ba44094b85874084b45c410", // text field with no validation.
    emotion: undefined, // use heroui select   EXCITED = "excited",SERIOUS = "serious",FRIENDLY = "friendly",SOOTHING = "soothing",BROADCASTER = "broadcaster"
  },
  language: "en", // leave this as a text filed, validate as two lower case letters, add a note saying only en, zh, ko, vi, fr, de, ja are well supported.
};

interface InteractiveAvatarProps {
  config?: StartAvatarRequest;
  showHistory?: boolean;
  autoStart?: boolean;
  cleanMode?: boolean;
  onProgrammaticSpeak?: (speak: (text: string) => void) => void;
}

export interface InteractiveAvatarRef {
  speak: (text: string) => void;
  startSession: () => Promise<void>;
  stopSession: () => void;
}

const CleanAvatarVideo = forwardRef<HTMLVideoElement, { cleanMode?: boolean }>(
  ({ cleanMode }, ref) => {
    const { sessionState } = useStreamingAvatarSession();
    const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;

    return (
      <>
        <video
          ref={ref}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        >
          <track kind="captions" />
        </video>
        {!isLoaded && (
          <div className="w-full h-full flex items-center justify-center absolute top-0 left-0">
            Loading...
          </div>
        )}
      </>
    );
  }
);
CleanAvatarVideo.displayName = "CleanAvatarVideo";

const InteractiveAvatar = forwardRef<
  InteractiveAvatarRef,
  InteractiveAvatarProps
>(
  (
    {
      config = DEFAULT_CONFIG,
      showHistory = true,
      autoStart = false,
      cleanMode = false,
      onProgrammaticSpeak,
    },
    ref
  ) => {
    const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
      useStreamingAvatarSession();
    const { startVoiceChat } = useVoiceChat();
    const { repeatMessage } = useTextChat();

    const mediaStream = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    // Adjust defaults when cleanMode is enabled
    const effectiveShowHistory = cleanMode ? false : showHistory;
    const effectiveAutoStart = cleanMode ? true : autoStart;

    async function fetchAccessToken() {
      try {
        const response = await fetch("/api/avatar/get-access-token", {
          method: "POST",
        });
        const token = await response.text();

        return token;
      } catch (error) {
        console.error("Error fetching access token:", error);
        throw error;
      }
    }

    const startRecording = useMemoizedFn(() => {
      if (!stream) {
        console.error("No stream available to record");
        return;
      }

      try {
        recordedChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9",
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, {
            type: "video/webm",
          });
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

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error starting recording:", error);
      }
    });

    const stopRecording = useMemoizedFn(() => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    });

    const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
      try {
        const newToken = await fetchAccessToken();
        const avatar = initAvatar(newToken);

        avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
          console.log("Avatar started talking", e);
        });
        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
          console.log("Avatar stopped talking", e);
        });
        avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
          console.log("Stream disconnected");
        });
        avatar.on(StreamingEvents.STREAM_READY, (event) => {
          console.log(">>>>> Stream ready:", event.detail);
          
          // Signal to main-display that the avatar stream is ready
          localStorage.setItem("kioskAvatarStreamReady", "true");
          window.dispatchEvent(new Event("storage"));
        });
        avatar.on(StreamingEvents.USER_START, (event) => {
          console.log(">>>>> User started talking:", event);
        });
        avatar.on(StreamingEvents.USER_STOP, (event) => {
          console.log(">>>>> User stopped talking:", event);
        });
        avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
          console.log(">>>>> User end message:", event);
        });
        avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
          console.log(">>>>> User talking message:", event);
        });
        avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
          console.log(">>>>> Avatar talking message:", event);
        });
        avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
          console.log(">>>>> Avatar end message:", event);
        });

        await startAvatar(config);

        if (isVoiceChat) {
          await startVoiceChat();
        }
      } catch (error) {
        console.error("Error starting avatar session:", error);
      }
    });

    // Expose imperative methods via ref
    useImperativeHandle(
      ref,
      () => ({
        speak: (text: string) => {
          repeatMessage(text);
        },
        startSession: async () => {
          await startSessionV2(false);
        },
        stopSession: () => {
          stopAvatar();
        },
      }),
      [repeatMessage, startSessionV2, stopAvatar]
    );

    // Expose programmatic speak function to parent
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

    useUnmount(() => {
      if (isRecording) {
        stopRecording();
      }
      stopAvatar();
    });

    useEffect(() => {
      if (stream && mediaStream.current) {
        mediaStream.current.srcObject = stream;
        mediaStream.current.onloadedmetadata = () => {
          mediaStream.current!.play();
        };
      }
    }, [mediaStream, stream]);

    // Auto-start if enabled
    useEffect(() => {
      if (
        effectiveAutoStart &&
        sessionState === StreamingAvatarSessionState.INACTIVE
      ) {
        startSessionV2(false);
      }
    }, [effectiveAutoStart, sessionState, startSessionV2]);

    if (cleanMode) {
      // Clean mode: just the video, no controls, no card wrapper
      return (
        <div className="w-full aspect-video relative overflow-hidden rounded-xl">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <CleanAvatarVideo ref={mediaStream} cleanMode={cleanMode} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full bg-default-100">
              {sessionState === StreamingAvatarSessionState.INACTIVE ? (
                <>
                  <Unplug size={20} />
                  <p>Disconnected</p>
                </>
              ) : (
                <LoaderCircle className="animate-spin" size={20} />
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col gap-4">
        <Card className="flex flex-col rounded-xl overflow-hidden w-full">
          <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
            {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
              <>
                <AvatarVideo ref={mediaStream} />
                {isRecording && (
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-danger/90 text-white px-3 py-1.5 rounded-full">
                    <Circle size={12} fill="currentColor" className="animate-pulse" />
                    <span className="text-sm font-medium">Recording</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <Unplug size={20} />
                <p>Disconnected</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 items-center justify-center p-4 border-t w-full">
            {sessionState === StreamingAvatarSessionState.CONNECTED ? (
              <>
                <TextInput />
                <div className="flex flex-row">
                  <Button
                    color={isRecording ? "danger" : "primary"}
                    variant={isRecording ? "flat" : "flat"}
                    onPress={isRecording ? stopRecording : startRecording}
                    startContent={
                      isRecording ? (
                        <Square size={16} fill="currentColor" />
                      ) : (
                        <Circle size={16} fill="currentColor" />
                      )
                    }
                  >
                    {isRecording ? "Stop Recording" : "Record"}
                  </Button>
                </div>
              </>
            ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
              <div className="flex flex-row gap-4">
                <Button color="primary" onClick={() => startSessionV2(false)}>
                  Start Real-Time Avatar
                </Button>
              </div>
            ) : (
              <LoaderCircle className="animate-spin" size={20} />
            )}
          </div>
        </Card>
        {effectiveShowHistory &&
          sessionState === StreamingAvatarSessionState.CONNECTED && (
            <MessageHistory />
          )}
      </div>
    );
  }
);
InteractiveAvatar.displayName = "InteractiveAvatar";

interface InteractiveAvatarWrapperProps {
  config?: StartAvatarRequest;
  showHistory?: boolean;
  autoStart?: boolean;
  cleanMode?: boolean;
  onProgrammaticSpeak?: (speak: (text: string) => void) => void;
}

const InteractiveAvatarWrapper = forwardRef<
  InteractiveAvatarRef,
  InteractiveAvatarWrapperProps
>(({ config, showHistory, autoStart, cleanMode, onProgrammaticSpeak }, ref) => {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_HEYGEN_BASE_API_URL}>
      <InteractiveAvatar
        ref={ref}
        config={config}
        showHistory={showHistory}
        autoStart={autoStart}
        cleanMode={cleanMode}
        onProgrammaticSpeak={onProgrammaticSpeak}
      />
    </StreamingAvatarProvider>
  );
});
InteractiveAvatarWrapper.displayName = "InteractiveAvatarWrapper";

export default InteractiveAvatarWrapper;
