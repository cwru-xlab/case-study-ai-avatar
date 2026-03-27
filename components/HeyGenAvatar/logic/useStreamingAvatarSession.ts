import { useCallback } from "react";
import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";

export const useStreamingAvatarSession = () => {
  const {
    sessionRef,
    sessionState,
    isStreamReady,
    connectionQuality,
    clearMessages,
    setIsListening,
  } = useStreamingAvatarContext();

  const startSession = useCallback(async () => {
    if (!sessionRef.current) return;
    return await sessionRef.current.start();
  }, [sessionRef]);

  const stopSession = useCallback(async () => {
    clearMessages();
    setIsListening(false);
    if (!sessionRef.current) return;
    return await sessionRef.current.stop();
  }, [sessionRef, clearMessages, setIsListening]);

  const keepAlive = useCallback(async () => {
    if (!sessionRef.current) return;
    return await sessionRef.current.keepAlive();
  }, [sessionRef]);

  const attachElement = useCallback(
    (element: HTMLMediaElement) => {
      if (!sessionRef.current) return;
      return sessionRef.current.attach(element);
    },
    [sessionRef],
  );

  return {
    sessionRef,
    sessionState,
    isStreamReady,
    connectionQuality,
    startSession,
    stopSession,
    keepAlive,
    attachElement,

    startAvatar: startSession,
    stopAvatar: stopSession,
  };
};
