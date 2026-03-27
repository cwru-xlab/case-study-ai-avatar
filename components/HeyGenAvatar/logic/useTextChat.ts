import { useCallback } from "react";
import { useStreamingAvatarContext } from "./context";

export const useTextChat = () => {
  const { sessionRef } = useStreamingAvatarContext();

  const sendMessage = useCallback(
    (message: string) => {
      if (!sessionRef.current) return;
      return sessionRef.current.message(message);
    },
    [sessionRef],
  );

  const repeatMessage = useCallback(
    (message: string) => {
      if (!sessionRef.current) return;
      return sessionRef.current.repeat(message);
    },
    [sessionRef],
  );

  return {
    sendMessage,
    sendMessageSync: sendMessage,
    repeatMessage,
    repeatMessageSync: repeatMessage,
  };
};
