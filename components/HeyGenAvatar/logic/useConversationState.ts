import { useCallback } from "react";
import { useStreamingAvatarContext } from "./context";

export const useConversationState = () => {
  const { sessionRef, isAvatarTalking, isUserTalking, isListening } =
    useStreamingAvatarContext();

  const startListening = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.startListening();
  }, [sessionRef]);

  const stopListening = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.stopListening();
  }, [sessionRef]);

  return {
    isAvatarListening: isListening,
    startListening,
    stopListening,
    isUserTalking,
    isAvatarTalking,
  };
};
